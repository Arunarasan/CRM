package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The project completion GATE (spec §42): a project is not "done" just because its tasks are — it
 * must satisfy a set of business conditions (work complete, quality passed, customer approval,
 * handover, billing cleared). This service evaluates those conditions into a readiness report;
 * {@link ProjectService#completeProject} refuses completion unless every condition holds or an
 * admin explicitly overrides.
 *
 * <p>Conditions are evaluated against existing module state (tasks, quality checks, customer
 * approvals, the PROJECT workflow's Handover phase, and the payment schedule) — nothing is
 * duplicated. Which conditions are enforced can later move into the workflow template; for now the
 * override is the per-completion escape hatch.
 */
@Service
public class ProjectCompletionService {

    private static final List<String> UNPAID_STATUSES = List.of("PENDING", "INVOICED", "PARTIAL", "OVERDUE");

    @Autowired private TaskRepository taskRepository;
    @Autowired private ProjectQualityCheckRepository qualityCheckRepository;
    @Autowired private ProjectCustomerApprovalRepository customerApprovalRepository;
    @Autowired private PaymentScheduleRepository paymentScheduleRepository;
    @Autowired private WorkflowInstanceRepository workflowInstanceRepository;
    @Autowired private WorkflowPhaseInstanceRepository workflowPhaseInstanceRepository;

    /** Full readiness report: {ready, conditions:[{code,label,satisfied,detail}], unmet:[labels]}. */
    public Map<String, Object> evaluate(Long projectId) {
        List<Map<String, Object>> conditions = new ArrayList<>();
        conditions.add(workComplete(projectId));
        conditions.add(qualityPassed(projectId));
        conditions.add(customerApproved(projectId));
        conditions.add(handoverDone(projectId));
        conditions.add(billingCleared(projectId));

        boolean ready = conditions.stream().allMatch(c -> Boolean.TRUE.equals(c.get("satisfied")));
        List<String> unmet = conditions.stream()
                .filter(c -> !Boolean.TRUE.equals(c.get("satisfied")))
                .map(c -> String.valueOf(c.get("label")))
                .toList();

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("ready", ready);
        report.put("conditions", conditions);
        report.put("unmet", unmet);
        return report;
    }

    /** One-line summary of what's blocking completion, for exception messages. */
    public String blockingSummary(Long projectId) {
        Object unmet = evaluate(projectId).get("unmet");
        List<?> list = (List<?>) unmet;
        if (list == null || list.isEmpty()) return "";
        return String.join("; ", list.stream().map(String::valueOf).toList());
    }

    // ------------------------------------------------------ conditions

    private Map<String, Object> workComplete(Long projectId) {
        List<Task> tasks = taskRepository.findByProjectId(projectId).stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .toList();
        long done = tasks.stream().filter(t -> "COMPLETED".equals(t.getStatus())).count();
        boolean ok = tasks.isEmpty() || done == tasks.size();
        return condition("WORK_COMPLETE", "Required work completed", ok,
                done + " of " + tasks.size() + " tasks completed");
    }

    private Map<String, Object> qualityPassed(Long projectId) {
        List<ProjectQualityCheck> checks = qualityCheckRepository.findByProjectId(projectId);
        long failing = checks.stream()
                .filter(c -> "REJECTED".equals(c.getStatus()) || "REWORK_REQUIRED".equals(c.getStatus()))
                .count();
        boolean ok = failing == 0;
        String detail = checks.isEmpty() ? "No quality checks recorded"
                : ok ? "All quality checks passed" : failing + " unresolved quality issue(s)";
        return condition("QUALITY_PASSED", "Quality inspection passed", ok, detail);
    }

    private Map<String, Object> customerApproved(Long projectId) {
        List<ProjectCustomerApproval> approvals = customerApprovalRepository.findByProjectId(projectId);
        boolean ok = approvals.stream().anyMatch(a ->
                "APPROVED".equals(a.getStatus()) && isCompletionApproval(a.getApprovalType()));
        return condition("CUSTOMER_APPROVED", "Customer approval received", ok,
                ok ? "Completion/handover approval on file" : "Awaiting customer completion/handover approval");
    }

    private Map<String, Object> handoverDone(Long projectId) {
        List<WorkflowInstance> instances = workflowInstanceRepository.findByProjectId(projectId);
        if (instances.isEmpty()) {
            // No PROJECT workflow (e.g. a legacy project) — don't block on a phase that doesn't exist.
            return condition("HANDOVER_DONE", "Handover completed", true, "No project workflow");
        }
        WorkflowInstance instance = instances.get(instances.size() - 1);
        WorkflowPhaseInstance handover = workflowPhaseInstanceRepository
                .findByWorkflowInstanceIdOrderByIdAsc(instance.getId()).stream()
                .filter(pi -> pi.getPhase() != null && "PROJECT_HANDOVER".equals(pi.getPhase().getCode()))
                .findFirst().orElse(null);
        boolean ok = handover != null && "COMPLETED".equals(handover.getStatus());
        return condition("HANDOVER_DONE", "Handover completed", ok,
                handover == null ? "Handover phase not found" : "Handover phase " + handover.getStatus().toLowerCase());
    }

    private Map<String, Object> billingCleared(Long projectId) {
        List<PaymentSchedule> schedules =
                paymentScheduleRepository.findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(projectId);
        long unpaid = schedules.stream().filter(s -> UNPAID_STATUSES.contains(s.getStatus())).count();
        boolean ok = unpaid == 0;
        String detail = schedules.isEmpty() ? "No payment schedule"
                : ok ? "All stages paid" : unpaid + " stage(s) outstanding";
        return condition("BILLING_CLEARED", "Billing conditions satisfied", ok, detail);
    }

    private boolean isCompletionApproval(String type) {
        if (type == null) return false;
        String t = type.toLowerCase();
        return t.contains("completion") || t.contains("handover") || t.contains("final");
    }

    private Map<String, Object> condition(String code, String label, boolean satisfied, String detail) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code);
        m.put("label", label);
        m.put("satisfied", satisfied);
        m.put("detail", detail);
        return m;
    }
}

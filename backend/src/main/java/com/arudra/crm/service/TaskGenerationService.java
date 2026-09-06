package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Turns {@link TaskTemplate}s into concrete {@link Task}s for an ACTIVE phase — the "system creates
 * the work automatically" half of the engine. Generation is progressive (only the active phase is
 * materialized) and idempotent (a template never produces two tasks in the same workflow run), so a
 * re-fired trigger can never duplicate work.
 */
@Service
public class TaskGenerationService {

    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskTemplateRepository taskTemplateRepository;
    @Autowired private TaskDependencyService taskDependencyService;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private com.arudra.crm.repository.LeadRepository leadRepository;
    @Autowired private TaskPoolNotifier taskPoolNotifier;
    @Autowired private WorkflowInstanceRepository workflowInstanceRepository;
    @Autowired private WorkflowPhaseInstanceRepository phaseInstanceRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;

    /**
     * Materialize every task template of the phase (in order), wiring instance-level dependencies so
     * the LOCKED/AVAILABLE gate works, and stamping the workflow subject onto each task.
     *
     * @return the tasks created by this call (already-existing ones are skipped).
     */
    public List<Task> materializePhase(WorkflowPhaseInstance phaseInstance) {
        WorkflowInstance instance = phaseInstance.getWorkflowInstance();
        List<TaskTemplate> templates =
                taskTemplateRepository.findByPhaseIdAndIsDeletedFalseOrderByOrderIndexAsc(phaseInstance.getPhase().getId());

        // Tasks already generated in this run, indexed by their originating template id — used both
        // for idempotency and to resolve instance-level dependency links.
        List<Task> existing = taskRepository.findByWorkflowInstanceId(instance.getId());

        List<Task> created = new ArrayList<>();
        for (TaskTemplate tpl : templates) {
            boolean already = existing.stream().anyMatch(
                    t -> t.getTaskTemplate() != null && t.getTaskTemplate().getId().equals(tpl.getId()));
            if (already) continue;

            Task task = buildTaskFromTemplate(tpl, phaseInstance, instance);

            // Wire instance-level dependencies to the sibling tasks generated from the prerequisite
            // templates (they were created earlier in this same loop, or in a prior call).
            Set<Task> deps = resolveDependencyTasks(tpl, existing, created);
            task.setDependencies(deps);
            task.setStatus(taskDependencyService.initialStatus(task));

            Task saved = taskRepository.save(task);
            created.add(saved);
        }

        // Ping the eligible workforce about every freshly pickable task (AVAILABLE, not LOCKED),
        // so auto-generated pool work is seen immediately rather than only on next app open.
        for (Task t : created) {
            taskPoolNotifier.notifyEligibleEmployees(t);
        }
        return created;
    }

    /**
     * Build (but do not save) a concrete task from a template within a phase instance — the shared
     * body used by both {@link #materializePhase} and {@link #spawnRepeatLeadTask}. Dependencies and
     * status are left to the caller (they are context-specific).
     */
    private Task buildTaskFromTemplate(TaskTemplate tpl, WorkflowPhaseInstance phaseInstance, WorkflowInstance instance) {
        Task task = new Task();
        task.setTaskName(tpl.getName());
        task.setDescription(tpl.getDescription());
        task.setPriority(tpl.getPriority() != null ? tpl.getPriority() : "MEDIUM");
        task.setSource("WORKFLOW");
        task.setCompletionRule(tpl.getCompletionRule());
        task.setAssignmentType(tpl.getAssignmentType());
        task.setEligibleRoles(tpl.getEligibleRoles());
        task.setEligibleSkills(tpl.getEligibleSkills());
        task.setEstimatedHours(tpl.getEstimatedHours());
        task.setOrderIndex(tpl.getOrderIndex());
        task.setTaskTemplate(tpl);
        task.setWorkflowInstance(instance);
        task.setWorkflowPhaseInstance(phaseInstance);
        task.setStartDate(LocalDate.now());
        task.setDueDate(computeDueDate(tpl));

        // Copy the subject pointers off the instance so the task is queryable by lead/project.
        if ("LEAD".equals(instance.getScope())) {
            task.setLeadId(instance.getLeadId());
            // The Site Visit & Measurement task is due on the visit date agreed during requirement.
            if ("TT_VISIT_MEASURE".equals(tpl.getCode()) && instance.getLeadId() != null) {
                leadRepository.findById(instance.getLeadId()).ifPresent(l -> {
                    if (l.getSiteVisitDate() != null) task.setDueDate(l.getSiteVisitDate());
                });
            }
        } else if ("PROJECT".equals(instance.getScope()) && instance.getProjectId() != null) {
            projectRepository.findById(instance.getProjectId()).ifPresent(p -> {
                task.setProject(p);
                if (p.getCustomer() != null) task.setCustomerId(p.getCustomer().getId());
            });
        }
        return task;
    }

    /**
     * Force-create a fresh instance of a lead-workflow task from its template, bypassing the
     * per-template idempotency guard {@link #materializePhase} enforces. Used for repeat attempts:
     * a new "Collect Requirement" on every follow-up, or a repeat "Site Visit & Measurement" when a
     * second visit is needed. The new task lands in the SAME phase as its template, so the phase
     * stays ACTIVE and the workflow does not advance (the caller closes the prior attempt AFTER this,
     * so the phase is never momentarily "all done"). Returns the new task, or null if the lead has no
     * active workflow / the template isn't in it.
     */
    @org.springframework.transaction.annotation.Transactional
    public Task spawnRepeatLeadTask(Long leadId, String templateCode, LocalDate dueDate,
                                    String nameOverride, com.arudra.crm.entity.User assignee) {
        if (leadId == null || templateCode == null) return null;
        WorkflowInstance instance = workflowInstanceRepository
                .findFirstByScopeAndLeadIdAndStatus("LEAD", leadId, "ACTIVE").orElse(null);
        if (instance == null) return null;

        // Locate the phase instance whose phase owns this (live) template code.
        WorkflowPhaseInstance phaseInstance = null;
        TaskTemplate template = null;
        for (WorkflowPhaseInstance pi : phaseInstanceRepository.findByWorkflowInstanceIdOrderByIdAsc(instance.getId())) {
            for (TaskTemplate tpl : taskTemplateRepository.findByPhaseIdAndIsDeletedFalseOrderByOrderIndexAsc(pi.getPhase().getId())) {
                if (templateCode.equals(tpl.getCode())) { phaseInstance = pi; template = tpl; break; }
            }
            if (template != null) break;
        }
        if (template == null || phaseInstance == null) return null;

        Task task = buildTaskFromTemplate(template, phaseInstance, instance);
        if (dueDate != null) task.setDueDate(dueDate);
        if (nameOverride != null && !nameOverride.isBlank()) task.setTaskName(nameOverride);
        task.setStatus(taskDependencyService.initialStatus(task)); // no dependencies → AVAILABLE
        Task saved = taskRepository.save(task);

        if (assignee != null) {
            TaskAssignment a = new TaskAssignment();
            a.setTask(saved);
            a.setResourceType(ResourceType.EMPLOYEE);
            a.setResourceId(assignee.getId());
            a.setEmployee(assignee);
            a.setAssignedBy(assignee);
            a.setRole("Owner"); // owns the repeat attempt (matters for OWNER_APPROVAL completion)
            a.setStatus("ACCEPTED");
            a.setAcceptedAt(LocalDateTime.now());
            assignmentRepository.save(a);
            saved.setAssignedEmployee(assignee);
            saved.setStatus("ACCEPTED");
            saved = taskRepository.save(saved);
        } else {
            // Unassigned → advertise to the eligible pool so someone can pick it up.
            taskPoolNotifier.notifyEligibleEmployees(saved);
        }
        return saved;
    }

    /** Map a template's template-level dependencies onto the concrete sibling tasks in this run. */
    private Set<Task> resolveDependencyTasks(TaskTemplate tpl, List<Task> existing, List<Task> created) {
        Set<Task> deps = new HashSet<>();
        if (tpl.getDependencies() == null) return deps;
        for (TaskTemplate depTpl : tpl.getDependencies()) {
            findTaskForTemplate(depTpl.getId(), existing, created).ifPresent(deps::add);
        }
        return deps;
    }

    private java.util.Optional<Task> findTaskForTemplate(Long templateId, List<Task> existing, List<Task> created) {
        for (Task t : created) {
            if (t.getTaskTemplate() != null && t.getTaskTemplate().getId().equals(templateId)) return java.util.Optional.of(t);
        }
        for (Task t : existing) {
            if (t.getTaskTemplate() != null && t.getTaskTemplate().getId().equals(templateId)) return java.util.Optional.of(t);
        }
        return java.util.Optional.empty();
    }

    private LocalDate computeDueDate(TaskTemplate tpl) {
        if (tpl.getDueOffsetDays() == null) return null;
        // Increment 1 supports the CREATION basis; PREV_COMPLETION / PHASE_START come with chaining.
        return LocalDate.now().plusDays(tpl.getDueOffsetDays());
    }
}

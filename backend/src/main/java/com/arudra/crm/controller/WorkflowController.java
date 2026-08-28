package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import com.arudra.crm.service.WorkflowService;
import com.arudra.crm.service.WorkflowTriggerService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Read + admin surface for the workflow engine: inspect configured templates, view a lead's live
 * workflow (phases + generated task states), and (admin) manually start a workflow for a lead that
 * pre-dates the engine. Task pick/complete stays on the existing task APIs.
 */
@RestController
@RequestMapping("/api/workflow")
@CrossOrigin(origins = "*")
public class WorkflowController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_READ') or hasAuthority('LEAD_READ')";
    private static final String ADMIN = "hasAuthority('ROLE_ADMIN')";

    private final WorkflowTemplateRepository templateRepository;
    private final WorkflowPhaseRepository phaseRepository;
    private final TaskTemplateRepository taskTemplateRepository;
    private final WorkflowInstanceRepository instanceRepository;
    private final WorkflowService workflowService;
    private final WorkflowTriggerService workflowTriggerService;
    private final TaskRepository taskRepository;
    private final LeadRepository leadRepository;

    public WorkflowController(WorkflowTemplateRepository templateRepository,
                             WorkflowPhaseRepository phaseRepository,
                             TaskTemplateRepository taskTemplateRepository,
                             WorkflowInstanceRepository instanceRepository,
                             WorkflowService workflowService,
                             WorkflowTriggerService workflowTriggerService,
                             TaskRepository taskRepository,
                             LeadRepository leadRepository) {
        this.templateRepository = templateRepository;
        this.phaseRepository = phaseRepository;
        this.taskTemplateRepository = taskTemplateRepository;
        this.instanceRepository = instanceRepository;
        this.workflowService = workflowService;
        this.workflowTriggerService = workflowTriggerService;
        this.taskRepository = taskRepository;
        this.leadRepository = leadRepository;
    }

    // ------------------------------------------------------ template config

    @GetMapping("/templates")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> templates() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (WorkflowTemplate t : templateRepository.findAll()) {
            Map<String, Object> tm = new LinkedHashMap<>();
            tm.put("id", t.getId());
            tm.put("code", t.getCode());
            tm.put("name", t.getName());
            tm.put("scope", t.getScope());
            tm.put("active", t.getActive());
            List<Map<String, Object>> phases = new ArrayList<>();
            for (WorkflowPhase p : phaseRepository.findByTemplateIdOrderByOrderIndexAsc(t.getId())) {
                Map<String, Object> pm = new LinkedHashMap<>();
                pm.put("id", p.getId());
                pm.put("name", p.getName());
                pm.put("code", p.getCode());
                pm.put("orderIndex", p.getOrderIndex());
                pm.put("tasks", taskTemplateRepository.findByPhaseIdOrderByOrderIndexAsc(p.getId()).stream()
                        .map(this::toTemplateTask).toList());
                phases.add(pm);
            }
            tm.put("phases", phases);
            out.add(tm);
        }
        return ResponseEntity.ok(ApiResponse.success(out));
    }

    private Map<String, Object> toTemplateTask(TaskTemplate tt) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", tt.getId());
        m.put("name", tt.getName());
        m.put("code", tt.getCode());
        m.put("orderIndex", tt.getOrderIndex());
        m.put("assignmentType", tt.getAssignmentType());
        m.put("completionRule", tt.getCompletionRule());
        m.put("eligibleRoles", tt.getEligibleRoles());
        m.put("priority", tt.getPriority());
        m.put("dependsOn", tt.getDependencies().stream().map(TaskTemplate::getCode).sorted().toList());
        return m;
    }

    // ------------------------------------------------------ live lead workflow

    @GetMapping("/leads/{leadId}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> leadWorkflow(@PathVariable Long leadId) {
        List<WorkflowInstance> instances = instanceRepository.findByLeadId(leadId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("leadId", leadId);
        if (instances.isEmpty()) {
            out.put("instance", null);
            out.put("phases", List.of());
            return ResponseEntity.ok(ApiResponse.success(out));
        }
        WorkflowInstance instance = instances.get(instances.size() - 1); // latest
        out.put("instanceId", instance.getId());
        out.put("status", instance.getStatus());
        out.put("templateCode", instance.getTemplate() != null ? instance.getTemplate().getCode() : null);

        List<WorkflowPhaseInstance> phaseInstances = workflowService.orderedPhaseInstances(instance);
        List<Task> tasks = taskRepository.findByWorkflowInstanceId(instance.getId());

        List<Map<String, Object>> phases = new ArrayList<>();
        for (WorkflowPhaseInstance pi : phaseInstances) {
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("phaseInstanceId", pi.getId());
            pm.put("name", pi.getPhase() != null ? pi.getPhase().getName() : null);
            pm.put("status", pi.getStatus());
            pm.put("progress", pi.getProgress());
            pm.put("tasks", tasks.stream()
                    .filter(t -> t.getWorkflowPhaseInstance() != null && t.getWorkflowPhaseInstance().getId().equals(pi.getId()))
                    .sorted(Comparator.comparing(t -> t.getOrderIndex() == null ? 0 : t.getOrderIndex()))
                    .map(this::toLiveTask).toList());
            phases.add(pm);
        }
        out.put("phases", phases);
        return ResponseEntity.ok(ApiResponse.success(out));
    }

    private Map<String, Object> toLiveTask(Task t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("taskName", t.getTaskName());
        m.put("status", t.getStatus());
        m.put("priority", t.getPriority());
        m.put("dueDate", t.getDueDate());
        m.put("eligibleRoles", t.getEligibleRoles());
        m.put("assignedEmployee", t.getAssignedEmployee() != null ? t.getAssignedEmployee().getName() : null);
        return m;
    }

    // ------------------------------------------------------ admin: backfill start

    @PostMapping("/leads/{leadId}/start")
    @PreAuthorize(ADMIN)
    public ResponseEntity<ApiResponse<Map<String, Object>>> startLead(@PathVariable Long leadId) {
        if (leadRepository.findById(leadId).isEmpty()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Lead not found"));
        }
        var instance = workflowService.startLeadWorkflow(leadId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("started", instance.isPresent());
        out.put("instanceId", instance.map(WorkflowInstance::getId).orElse(null));
        return ResponseEntity.ok(ApiResponse.success(out,
                instance.isPresent() ? "Workflow active for lead" : "No active LEAD template configured"));
    }
}

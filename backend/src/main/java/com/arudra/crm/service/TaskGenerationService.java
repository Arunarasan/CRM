package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
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
    @Autowired private TaskPoolNotifier taskPoolNotifier;

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
            } else if ("PROJECT".equals(instance.getScope()) && instance.getProjectId() != null) {
                projectRepository.findById(instance.getProjectId()).ifPresent(p -> {
                    task.setProject(p);
                    if (p.getCustomer() != null) task.setCustomerId(p.getCustomer().getId());
                });
            }

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

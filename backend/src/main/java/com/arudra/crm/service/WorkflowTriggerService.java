package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * The business-event layer of the workflow engine — the single place other modules call when
 * something happens ("a lead was created", "a task was completed"). It decides what the engine
 * should do next: kick off a workflow, unlock dependent tasks, complete a phase, and advance to the
 * next one. Every entry point is idempotent and defensive so a workflow hiccup can never break the
 * host operation (lead creation, task approval, …) that triggered it.
 */
@Service
public class WorkflowTriggerService {

    private static final Logger log = LoggerFactory.getLogger(WorkflowTriggerService.class);

    @Autowired private WorkflowService workflowService;
    @Autowired private TaskDependencyService taskDependencyService;
    @Autowired private TaskRepository taskRepository;
    @Autowired private WorkflowInstanceRepository instanceRepository;
    @Autowired private WorkflowPhaseInstanceRepository phaseInstanceRepository;
    @Autowired private ProjectService projectService;

    /** A new lead was created — spin up its LEAD workflow and generate the first task(s). */
    @Transactional
    public void onLeadCreated(Lead lead) {
        if (lead == null || lead.getId() == null) return;
        try {
            workflowService.startLeadWorkflow(lead.getId());
        } catch (Exception e) {
            // Never let workflow automation break lead creation.
            log.error("Failed to start lead workflow for lead {}", lead.getId(), e);
        }
    }

    /**
     * A workflow task reached COMPLETED. Unlock any siblings it was gating and, if its phase is now
     * fully done, complete the phase and activate the next one (progressive generation). No-op for
     * manual tasks or tasks outside a workflow.
     */
    @Transactional
    public void onTaskCompleted(Task task) {
        if (task == null || !"WORKFLOW".equals(task.getSource()) || task.getWorkflowInstance() == null) {
            return;
        }
        try {
            taskDependencyService.unlockDependents(task);

            WorkflowPhaseInstance phaseInstance = task.getWorkflowPhaseInstance();
            if (phaseInstance == null) return;
            // Reload to observe the freshest status (the task's completion save is already flushed).
            phaseInstance = phaseInstanceRepository.findById(phaseInstance.getId()).orElse(phaseInstance);
            if (!"ACTIVE".equals(phaseInstance.getStatus())) return;

            if (allPhaseTasksDone(phaseInstance.getId())) {
                completePhaseAndAdvance(phaseInstance);
            }
        } catch (Exception e) {
            log.error("Workflow advance failed after task {} completion", task.getId(), e);
        }
    }

    // ---------------------------------------------------------------- lead chaining (business events)

    /**
     * Site visit completed in the SiteVisit module.
     * <p>Old-template leads (separate Site Visit + Measurement phases) advance past the Site Visit phase
     * so the Measurement task appears next. Combined-template leads (the single "Site Visit & Measurement"
     * phase, with no LEAD_MEASUREMENT phase) must NOT advance here — the site visit is only half the
     * combined step; completing the measurement is what closes the phase and moves on to BOQ. Otherwise
     * finishing the visit would skip straight to BOQ with no measurement recorded.
     */
    @Transactional
    public void onSiteVisitCompleted(SiteVisit visit) {
        if (visit == null || visit.getLead() == null) return;
        if (instanceHasPhase(visit.getLead().getId(), "LEAD_MEASUREMENT")) {
            advanceLeadPhaseOnEvent(visit.getLead().getId(), "LEAD_SITE_VISIT");
        }
    }

    /**
     * Measurement completed → advance the lead workflow past the measurement work (generates the BOQ
     * task). Old-template leads advance their standalone LEAD_MEASUREMENT phase; combined-template leads
     * advance the single LEAD_SITE_VISIT phase (which is where the measurement work now lives).
     */
    @Transactional
    public void onMeasurementCompleted(Measurement measurement) {
        if (measurement == null || measurement.getLead() == null) return;
        Long leadId = measurement.getLead().getId();
        if (instanceHasPhase(leadId, "LEAD_MEASUREMENT")) {
            advanceLeadPhaseOnEvent(leadId, "LEAD_MEASUREMENT");
        } else {
            advanceLeadPhaseOnEvent(leadId, "LEAD_SITE_VISIT");
        }
    }

    /** True when the lead's active workflow instance contains a phase with the given code — used to tell
     *  an old-template lead (separate Measurement phase) from a combined-template one. */
    private boolean instanceHasPhase(Long leadId, String phaseCode) {
        if (leadId == null) return false;
        WorkflowInstance instance = instanceRepository
                .findFirstByScopeAndLeadIdAndStatus("LEAD", leadId, "ACTIVE").orElse(null);
        if (instance == null) return false;
        return workflowService.orderedPhaseInstances(instance).stream()
                .anyMatch(pi -> phaseCode.equals(pi.getPhase().getCode()));
    }

    /** BOQ approved → advance the lead workflow past BOQ (generates the Quotation tasks). */
    @Transactional
    public void onBoqApproved(Boq boq) {
        if (boq == null || boq.getLead() == null) return;
        advanceLeadPhaseOnEvent(boq.getLead().getId(), "LEAD_BOQ");
    }

    /**
     * A project was created from an approved quotation. Completes the lead workflow, starts the
     * PROJECT workflow (progressive — Setup phase activates), and generates execution tasks from the
     * approved BOQ scope. All best-effort so conversion itself never fails.
     */
    @Transactional
    public void onProjectCreated(Project project, boolean generateExecutionTasks) {
        if (project == null || project.getId() == null) return;
        try {
            if (project.getLead() != null) {
                // Idempotent — for a floor-split (several projects, one lead) this closes the lead
                // workflow on the first call and is a no-op thereafter.
                advanceLeadPhaseOnEvent(project.getLead().getId(), "LEAD_QUOTATION");
            }
            workflowService.startProjectWorkflow(project.getId());
            // Materialize execution tasks/rooms from the linked BOQ (idempotent, safe to re-run).
            // Skipped for floor-split conversions, where each project owns only a slice of the BOQ
            // and per-project generation is done deliberately by a manager instead.
            if (generateExecutionTasks && project.getBoq() != null) {
                projectService.reconcileProjectWithBoq(project.getId(), null);
            }
        } catch (Exception e) {
            log.error("Workflow setup failed for project {} created from quotation", project.getId(), e);
        }
    }

    /**
     * Fast-forward a lead's active workflow through (and including) the phase identified by
     * {@code phaseCode}, then activate the next phase. Reaching a downstream business milestone
     * implies the upstream phases are done, so any not-yet-completed phase up to the target is closed
     * (its materialized tasks marked COMPLETED). Idempotent: already-completed phases are skipped.
     */
    private void advanceLeadPhaseOnEvent(Long leadId, String phaseCode) {
        if (leadId == null) return;
        try {
            WorkflowInstance instance = instanceRepository
                    .findFirstByScopeAndLeadIdAndStatus("LEAD", leadId, "ACTIVE").orElse(null);
            if (instance == null) return;

            List<WorkflowPhaseInstance> ordered = workflowService.orderedPhaseInstances(instance);
            int targetIndex = -1;
            for (int i = 0; i < ordered.size(); i++) {
                if (phaseCode.equals(ordered.get(i).getPhase().getCode())) { targetIndex = i; break; }
            }
            if (targetIndex < 0) return;

            for (int i = 0; i <= targetIndex; i++) {
                WorkflowPhaseInstance pi = ordered.get(i);
                if ("COMPLETED".equals(pi.getStatus())) continue;
                for (Task t : taskRepository.findByWorkflowPhaseInstanceId(pi.getId())) {
                    if (!"CANCELLED".equals(t.getStatus()) && !"COMPLETED".equals(t.getStatus())) {
                        t.setStatus("COMPLETED");
                        t.setCompletedDate(java.time.LocalDate.now());
                        taskRepository.save(t);
                    }
                }
                pi.setStatus("COMPLETED");
                pi.setProgress(100);
                pi.setCompletedAt(LocalDateTime.now());
                phaseInstanceRepository.save(pi);
            }

            if (targetIndex + 1 < ordered.size()) {
                WorkflowPhaseInstance next = ordered.get(targetIndex + 1);
                if ("PENDING".equals(next.getStatus())) {
                    workflowService.activatePhase(next);
                }
            } else {
                instance.setStatus("COMPLETED");
                instance.setCompletedAt(LocalDateTime.now());
                instanceRepository.save(instance);
            }
        } catch (Exception e) {
            log.error("Lead workflow advance-on-event failed (lead {}, phase {})", leadId, phaseCode, e);
        }
    }

    private boolean allPhaseTasksDone(Long phaseInstanceId) {
        List<Task> tasks = taskRepository.findByWorkflowPhaseInstanceId(phaseInstanceId).stream()
                .filter(t -> !"CANCELLED".equals(t.getStatus()))
                .toList();
        return !tasks.isEmpty() && tasks.stream().allMatch(t -> "COMPLETED".equals(t.getStatus()));
    }

    private void completePhaseAndAdvance(WorkflowPhaseInstance phaseInstance) {
        phaseInstance.setStatus("COMPLETED");
        phaseInstance.setProgress(100);
        phaseInstance.setCompletedAt(LocalDateTime.now());
        phaseInstanceRepository.save(phaseInstance);

        WorkflowInstance instance = phaseInstance.getWorkflowInstance();
        var next = workflowService.nextPendingPhase(instance);
        if (next.isPresent()) {
            workflowService.activatePhase(next.get());
        } else {
            instance.setStatus("COMPLETED");
            instance.setCompletedAt(LocalDateTime.now());
            instanceRepository.save(instance);
        }
    }
}

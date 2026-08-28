package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Owns the lifecycle of {@link WorkflowInstance}s: instantiating a template for a subject, and
 * activating phases one at a time (progressive generation). Kept separate from the trigger layer so
 * the "what to run" logic (WorkflowTriggerService) stays decoupled from the "how a workflow moves"
 * mechanics here.
 */
@Service
public class WorkflowService {

    @Autowired private WorkflowTemplateRepository templateRepository;
    @Autowired private WorkflowPhaseRepository phaseRepository;
    @Autowired private WorkflowInstanceRepository instanceRepository;
    @Autowired private WorkflowPhaseInstanceRepository phaseInstanceRepository;
    @Autowired private TaskGenerationService taskGenerationService;

    /**
     * Start (or return the existing) LEAD workflow for a lead. Idempotent: a second call for the
     * same lead never spawns a second run or duplicate tasks.
     */
    @Transactional
    public Optional<WorkflowInstance> startLeadWorkflow(Long leadId) {
        Optional<WorkflowInstance> active =
                instanceRepository.findFirstByScopeAndLeadIdAndStatus("LEAD", leadId, "ACTIVE");
        if (active.isPresent()) return active;

        List<WorkflowTemplate> templates = templateRepository.findByScopeAndActiveTrue("LEAD");
        if (templates.isEmpty()) return Optional.empty();
        // Prefer the canonical default; otherwise take the first active LEAD template.
        WorkflowTemplate template = templates.stream()
                .filter(t -> "LEAD_DEFAULT".equals(t.getCode()))
                .findFirst().orElse(templates.get(0));

        return Optional.of(instantiate(template, "LEAD", leadId, null));
    }

    /**
     * Start (or return the existing) PROJECT workflow for a project. Idempotent per project.
     */
    @Transactional
    public Optional<WorkflowInstance> startProjectWorkflow(Long projectId) {
        Optional<WorkflowInstance> active =
                instanceRepository.findFirstByScopeAndProjectIdAndStatus("PROJECT", projectId, "ACTIVE");
        if (active.isPresent()) return active;

        List<WorkflowTemplate> templates = templateRepository.findByScopeAndActiveTrue("PROJECT");
        if (templates.isEmpty()) return Optional.empty();
        WorkflowTemplate template = templates.stream()
                .filter(t -> "PROJECT_DEFAULT".equals(t.getCode()))
                .findFirst().orElse(templates.get(0));

        return Optional.of(instantiate(template, "PROJECT", null, projectId));
    }

    /** Create the instance + one PENDING phase instance per phase, then activate the first phase. */
    @Transactional
    public WorkflowInstance instantiate(WorkflowTemplate template, String scope, Long leadId, Long projectId) {
        WorkflowInstance instance = new WorkflowInstance();
        instance.setTemplate(template);
        instance.setScope(scope);
        instance.setLeadId(leadId);
        instance.setProjectId(projectId);
        instance.setStatus("ACTIVE");
        instance.setStartedAt(LocalDateTime.now());
        instance = instanceRepository.save(instance);

        List<WorkflowPhase> phases = phaseRepository.findByTemplateIdAndIsDeletedFalseOrderByOrderIndexAsc(template.getId());
        for (WorkflowPhase phase : phases) {
            WorkflowPhaseInstance pi = new WorkflowPhaseInstance();
            pi.setWorkflowInstance(instance);
            pi.setPhase(phase);
            pi.setStatus("PENDING");
            pi.setProgress(0);
            phaseInstanceRepository.save(pi);
        }

        nextPendingPhase(instance).ifPresent(this::activatePhase);
        return instance;
    }

    /** Mark a phase ACTIVE and materialize its tasks. Safe to call once per phase. */
    @Transactional
    public void activatePhase(WorkflowPhaseInstance phaseInstance) {
        if (!"PENDING".equals(phaseInstance.getStatus())) return;
        phaseInstance.setStatus("ACTIVE");
        phaseInstance.setStartedAt(LocalDateTime.now());
        phaseInstanceRepository.save(phaseInstance);
        taskGenerationService.materializePhase(phaseInstance);
    }

    /** The lowest-ordered phase instance still PENDING, or empty when the workflow is out of phases. */
    public Optional<WorkflowPhaseInstance> nextPendingPhase(WorkflowInstance instance) {
        return orderedPhaseInstances(instance).stream()
                .filter(pi -> "PENDING".equals(pi.getStatus()))
                .findFirst();
    }

    public List<WorkflowPhaseInstance> orderedPhaseInstances(WorkflowInstance instance) {
        return phaseInstanceRepository.findByWorkflowInstanceIdOrderByIdAsc(instance.getId()).stream()
                .sorted(Comparator.comparing(pi -> pi.getPhase().getOrderIndex(),
                        Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.TaskRepository;
import com.arudra.crm.repository.WorkflowInstanceRepository;
import com.arudra.crm.repository.WorkflowPhaseInstanceRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Workflow event layer: completing the last task of an ACTIVE phase completes that phase and
 * activates the next (progressive generation); non-workflow tasks are ignored; lead creation kicks
 * off the lead workflow. Repositories/collaborators mocked — no DB.
 */
class WorkflowTriggerServiceTest {

    @Mock WorkflowService workflowService;
    @Mock TaskDependencyService taskDependencyService;
    @Mock TaskRepository taskRepository;
    @Mock WorkflowInstanceRepository instanceRepository;
    @Mock WorkflowPhaseInstanceRepository phaseInstanceRepository;
    @Mock ProjectService projectService;

    @InjectMocks WorkflowTriggerService svc;

    @BeforeEach
    void setup() { MockitoAnnotations.openMocks(this); }

    @Test
    void onTaskCompleted_lastTaskOfPhase_completesPhaseAndActivatesNext() {
        WorkflowInstance instance = new WorkflowInstance();
        instance.setId(1L);

        WorkflowPhaseInstance phase = new WorkflowPhaseInstance();
        phase.setId(100L);
        phase.setStatus("ACTIVE");
        phase.setWorkflowInstance(instance);

        Task task = new Task();
        task.setId(50L);
        task.setSource("WORKFLOW");
        task.setStatus("COMPLETED");
        task.setWorkflowInstance(instance);
        task.setWorkflowPhaseInstance(phase);

        WorkflowPhaseInstance nextPhase = new WorkflowPhaseInstance();
        nextPhase.setId(101L);
        nextPhase.setStatus("PENDING");

        when(phaseInstanceRepository.findById(100L)).thenReturn(Optional.of(phase));
        when(taskRepository.findByWorkflowPhaseInstanceId(100L)).thenReturn(List.of(task)); // all done
        when(workflowService.nextPendingPhase(instance)).thenReturn(Optional.of(nextPhase));

        svc.onTaskCompleted(task);

        assertEquals("COMPLETED", phase.getStatus());
        verify(taskDependencyService).unlockDependents(task);
        verify(workflowService).activatePhase(nextPhase);
    }

    @Test
    void onTaskCompleted_manualTask_isIgnored() {
        Task task = new Task();
        task.setSource("MANUAL");
        task.setStatus("COMPLETED");

        svc.onTaskCompleted(task);

        verifyNoInteractions(taskDependencyService, workflowService, phaseInstanceRepository);
    }

    @Test
    void onLeadCreated_startsLeadWorkflow() {
        Lead lead = new Lead();
        lead.setId(9L);
        when(workflowService.startLeadWorkflow(9L)).thenReturn(Optional.empty());

        svc.onLeadCreated(lead);

        verify(workflowService).startLeadWorkflow(9L);
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.ProjectRepository;
import com.arudra.crm.repository.TaskRepository;
import com.arudra.crm.repository.TaskTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.MockitoAnnotations;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Progressive task generation: a phase materializes one task per template, with the correct
 * LOCKED/AVAILABLE gate, and never duplicates a task that already exists in the run (idempotency).
 * A real {@link TaskDependencyService} (spy) supplies the gate logic; repositories are mocked.
 */
class TaskGenerationServiceTest {

    @Mock TaskRepository taskRepository;
    @Mock TaskTemplateRepository taskTemplateRepository;
    @Mock ProjectRepository projectRepository;
    @Spy TaskDependencyService taskDependencyService = new TaskDependencyService();

    @InjectMocks TaskGenerationService svc;

    private WorkflowInstance instance;
    private WorkflowPhaseInstance phaseInstance;
    private TaskTemplate tplA;
    private TaskTemplate tplB;

    @BeforeEach
    void setup() {
        MockitoAnnotations.openMocks(this);
        when(taskRepository.save(any(Task.class))).thenAnswer(i -> i.getArgument(0));

        WorkflowTemplate template = new WorkflowTemplate();
        template.setId(1L);
        instance = new WorkflowInstance();
        instance.setId(1L);
        instance.setScope("LEAD");
        instance.setLeadId(5L);
        instance.setTemplate(template);

        WorkflowPhase phase = new WorkflowPhase();
        phase.setId(10L);
        phase.setCode("LEAD_QUALIFICATION");

        phaseInstance = new WorkflowPhaseInstance();
        phaseInstance.setId(100L);
        phaseInstance.setPhase(phase);
        phaseInstance.setWorkflowInstance(instance);

        tplA = template("A", 1L, 1);
        tplB = template("B", 2L, 2);
        tplB.setDependencies(Set.of(tplA)); // B waits on A
    }

    private TaskTemplate template(String name, Long id, int order) {
        TaskTemplate t = new TaskTemplate();
        t.setId(id);
        t.setName(name);
        t.setOrderIndex(order);
        t.setPriority("MEDIUM");
        t.setAssignmentType("SINGLE_EMPLOYEE");
        t.setCompletionRule("OWNER_APPROVAL");
        t.setEligibleRoles("Sales");
        return t;
    }

    @Test
    void materializePhase_firstTaskAvailable_dependentLocked_andStampsLead() {
        when(taskTemplateRepository.findByPhaseIdOrderByOrderIndexAsc(10L)).thenReturn(List.of(tplA, tplB));
        when(taskRepository.findByWorkflowInstanceId(1L)).thenReturn(List.of());

        List<Task> created = svc.materializePhase(phaseInstance);

        assertEquals(2, created.size());
        Task a = created.stream().filter(t -> "A".equals(t.getTaskName())).findFirst().orElseThrow();
        Task b = created.stream().filter(t -> "B".equals(t.getTaskName())).findFirst().orElseThrow();

        assertEquals("AVAILABLE", a.getStatus());     // no deps → available
        assertEquals("LOCKED", b.getStatus());         // depends on A (not yet completed)
        assertEquals("WORKFLOW", a.getSource());
        assertEquals(5L, a.getLeadId());               // subject stamped from the instance
        assertTrue(b.getDependencies().contains(a));   // instance-level dependency wired
    }

    @Test
    void materializePhase_isIdempotent_skipsAlreadyGeneratedTemplates() {
        // A already exists in the run — only B should be freshly created.
        Task existingA = new Task();
        existingA.setTaskName("A");
        existingA.setStatus("COMPLETED");
        existingA.setTaskTemplate(tplA);
        when(taskRepository.findByWorkflowInstanceId(1L)).thenReturn(List.of(existingA));
        when(taskTemplateRepository.findByPhaseIdOrderByOrderIndexAsc(10L)).thenReturn(List.of(tplA, tplB));

        List<Task> created = svc.materializePhase(phaseInstance);

        assertEquals(1, created.size());
        assertEquals("B", created.get(0).getTaskName());
        // A is already COMPLETED, so B's dependency is satisfied → B is AVAILABLE.
        assertEquals("AVAILABLE", created.get(0).getStatus());
    }
}

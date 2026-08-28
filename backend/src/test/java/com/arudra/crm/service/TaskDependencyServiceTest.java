package com.arudra.crm.service;

import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.WorkflowInstance;
import com.arudra.crm.repository.TaskRepository;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Pure-logic guard for the workflow LOCKED/AVAILABLE gate. No Spring context / DB — the two methods
 * under test read only {@code Task.dependencies}.
 */
class TaskDependencyServiceTest {

    private final TaskDependencyService svc = new TaskDependencyService();

    private Task task(String status) {
        Task t = new Task();
        t.setStatus(status);
        return t;
    }

    @Test
    void noDependencies_isAvailable() {
        Task t = task(null);
        assertTrue(svc.dependenciesSatisfied(t));
        assertEquals(TaskDependencyService.AVAILABLE, svc.initialStatus(t));
    }

    @Test
    void incompleteDependency_locksTask() {
        Task dep = task("IN_PROGRESS");
        Task t = task(null);
        t.setDependencies(Set.of(dep));
        assertFalse(svc.dependenciesSatisfied(t));
        assertEquals(TaskDependencyService.LOCKED, svc.initialStatus(t));
    }

    @Test
    void allDependenciesCompleted_unlocksTask() {
        Task depA = task("COMPLETED");
        Task depB = task("COMPLETED");
        Task t = task(null);
        t.setDependencies(Set.of(depA, depB));
        assertTrue(svc.dependenciesSatisfied(t));
        assertEquals(TaskDependencyService.AVAILABLE, svc.initialStatus(t));
    }

    @Test
    void oneIncompleteAmongMany_keepsLocked() {
        Task depA = task("COMPLETED");
        Task depB = task("AVAILABLE");
        Task t = task(null);
        t.setDependencies(Set.of(depA, depB));
        assertFalse(svc.dependenciesSatisfied(t));
    }

    @Test
    void unlockDependents_promotesOnlyThoseWhoseDepsAreAllComplete() {
        TaskRepository repo = Mockito.mock(TaskRepository.class);
        ReflectionTestUtils.setField(svc, "taskRepository", repo);

        WorkflowInstance instance = new WorkflowInstance();
        instance.setId(1L);

        Task completed = task("COMPLETED");
        completed.setWorkflowInstance(instance);

        Task readyDependent = task("LOCKED");   // its only dep (completed) is done → should unlock
        readyDependent.setDependencies(Set.of(completed));

        Task blockedDependent = task("LOCKED");  // still has an incomplete dep → stays locked
        blockedDependent.setDependencies(Set.of(completed, task("IN_PROGRESS")));

        when(repo.findByWorkflowInstanceId(1L)).thenReturn(List.of(readyDependent, blockedDependent));
        when(repo.save(any(Task.class))).thenAnswer(i -> i.getArgument(0));

        int promoted = svc.unlockDependents(completed);

        assertEquals(1, promoted);
        assertEquals("AVAILABLE", readyDependent.getStatus());
        assertEquals("LOCKED", blockedDependent.getStatus());
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.Task;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class TaskLifecycleServiceTest {

    private static Task task(String status) {
        Task t = new Task();
        t.setStatus(status);
        return t;
    }

    @Test
    void closedTasksAreNeverActive() {
        assertEquals("DONE", TaskLifecycleService.lifecycleOf(task("COMPLETED"), "IN_PROGRESS"));
        assertEquals("CANCELLED", TaskLifecycleService.lifecycleOf(task("CANCELLED"), "ASSIGNED"));
    }

    @Test
    void submittedWorkIsNotActive() {
        assertEquals("SUBMITTED", TaskLifecycleService.lifecycleOf(task("IN_PROGRESS"), "COMPLETED"));
        assertEquals("SUBMITTED", TaskLifecycleService.lifecycleOf(task("WAITING_APPROVAL"), "ACCEPTED"));
        assertFalse(TaskLifecycleService.isOpenForEmployee(task("WAITING_APPROVAL"), null));
    }

    @Test
    void reworkAndInProgressStayActive() {
        assertTrue(TaskLifecycleService.isOpenForEmployee(task("REWORK"), "REWORK"));
        assertTrue(TaskLifecycleService.isOpenForEmployee(task("IN_PROGRESS"), "IN_PROGRESS"));
    }
}

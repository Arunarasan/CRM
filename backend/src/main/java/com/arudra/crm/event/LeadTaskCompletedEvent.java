package com.arudra.crm.event;

/**
 * Published when a lead-workflow task is finalized (auto-finalized on submit, or manager-approved).
 * LeadTaskFormService listens and applies that task's captured form data onto the native lead —
 * so the collected information updates the lead only once the task is approved, without EmployeeTaskService
 * depending on LeadTaskFormService (which would create a cycle).
 */
public class LeadTaskCompletedEvent {
    private final Long taskId;

    public LeadTaskCompletedEvent(Long taskId) {
        this.taskId = taskId;
    }

    public Long getTaskId() {
        return taskId;
    }
}

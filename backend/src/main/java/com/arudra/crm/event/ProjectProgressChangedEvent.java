package com.arudra.crm.event;

/**
 * Published by ProjectService whenever a project's rolled-up work progress is recomputed.
 * Listeners (e.g. billing automation) react to the new work % without ProjectService needing a
 * direct dependency on them — this keeps the progress rollup and finance concerns decoupled.
 */
public class ProjectProgressChangedEvent {
    private final Long projectId;

    public ProjectProgressChangedEvent(Long projectId) {
        this.projectId = projectId;
    }

    public Long getProjectId() {
        return projectId;
    }
}

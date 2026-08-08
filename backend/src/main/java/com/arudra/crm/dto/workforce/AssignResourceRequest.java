package com.arudra.crm.dto.workforce;

/** One resource to assign to a task via the unified picker: a (resourceType, resourceId) pair + optional role. */
public class AssignResourceRequest {

    private String resourceType; // EMPLOYEE, CONTRACTOR, ...
    private Long resourceId;
    private String role;         // e.g. LEAD, HELPER

    public AssignResourceRequest() {}

    public AssignResourceRequest(String resourceType, Long resourceId, String role) {
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.role = role;
    }

    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }
    public Long getResourceId() { return resourceId; }
    public void setResourceId(Long resourceId) { this.resourceId = resourceId; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}

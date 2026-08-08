package com.arudra.crm.dto.workforce;

import com.arudra.crm.entity.Contractor;
import com.arudra.crm.entity.ResourceType;
import com.arudra.crm.entity.User;

/**
 * A resource-type-agnostic view of an assignable workforce resource (employee or contractor),
 * so the Project module can render and pick either from one list without caring which master
 * table it lives in.
 */
public class WorkforceResourceView {

    private String resourceType;   // EMPLOYEE, CONTRACTOR, ...
    private Long resourceId;       // users.id or contractors.id
    private String name;
    private String subtitle;       // employee: primary role/email; contractor: trade/company
    private String contact;        // email or phone

    public WorkforceResourceView() {}

    public WorkforceResourceView(String resourceType, Long resourceId, String name, String subtitle, String contact) {
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.name = name;
        this.subtitle = subtitle;
        this.contact = contact;
    }

    public static WorkforceResourceView ofEmployee(User u) {
        String role = (u.getRoles() != null && !u.getRoles().isEmpty())
                ? u.getRoles().iterator().next().getName() : null;
        return new WorkforceResourceView(ResourceType.EMPLOYEE, u.getId(), u.getName(),
                role != null ? role : u.getEmail(), u.getEmail());
    }

    public static WorkforceResourceView ofContractor(Contractor c) {
        String subtitle = c.getTrade() != null ? c.getTrade()
                : (c.getCompanyName() != null ? c.getCompanyName() : "Contractor");
        return new WorkforceResourceView(ResourceType.CONTRACTOR, c.getId(), c.getName(),
                subtitle, c.getPhone() != null ? c.getPhone() : c.getEmail());
    }

    public String getResourceType() { return resourceType; }
    public void setResourceType(String resourceType) { this.resourceType = resourceType; }
    public Long getResourceId() { return resourceId; }
    public void setResourceId(Long resourceId) { this.resourceId = resourceId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getSubtitle() { return subtitle; }
    public void setSubtitle(String subtitle) { this.subtitle = subtitle; }
    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }
}

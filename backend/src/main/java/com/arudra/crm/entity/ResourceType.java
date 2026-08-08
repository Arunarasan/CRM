package com.arudra.crm.entity;

import java.util.Set;

/**
 * Workforce resource types the Project module can assign work to. Kept as String constants
 * (not a DB enum) to match the codebase convention — every status/type field is a plain String.
 *
 * <p>Adding a future resource type (freelancer already reserved here) means adding a constant and
 * one branch in {@code WorkforceResourceService} — {@code resource_id} is a plain id, so no schema
 * change is needed.
 */
public final class ResourceType {

    public static final String EMPLOYEE = "EMPLOYEE";       // -> users.id
    public static final String CONTRACTOR = "CONTRACTOR";   // -> contractors.id
    // Reserved for future expansion (resolve/list branches to be added when introduced):
    public static final String FREELANCER = "FREELANCER";
    public static final String SUBCONTRACTOR = "SUBCONTRACTOR";
    public static final String CONSULTANT = "CONSULTANT";
    public static final String VENDOR = "VENDOR";

    /** Types actually assignable today. Future types join this set once their resolver branch exists. */
    public static final Set<String> ASSIGNABLE = Set.of(EMPLOYEE, CONTRACTOR);

    private ResourceType() {}

    public static boolean isValid(String type) {
        return type != null && ASSIGNABLE.contains(type.toUpperCase());
    }

    public static String normalize(String type) {
        return type == null ? null : type.trim().toUpperCase();
    }
}

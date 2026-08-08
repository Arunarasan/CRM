package com.arudra.crm.dto.workforce;

import lombok.Getter;
import lombok.Setter;

/**
 * One row of the unified workforce directory: Name · Type · Skill · Status · Active Projects,
 * plus the extension keys/fields the frontend needs for filtering (department, company) and
 * deep-linking (employeeId / contractorId).
 */
@Getter
@Setter
public class WorkforceListRow {

    private Long id;                 // workforce.id
    private String workforceType;
    private String fullName;
    private String primarySkill;
    private String status;
    private long activeProjects;
    private String mobile;
    private String email;
    private String profilePhotoUrl;

    // Extension context (null for the non-matching type)
    private Long employeeId;
    private String department;
    private Long contractorId;
    private String companyName;
}

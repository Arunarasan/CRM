package com.arudra.crm.dto.workforce;

import com.arudra.crm.entity.Contractor;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.Workforce;
import com.arudra.crm.entity.WorkforceDocument;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/**
 * Full unified profile: the shared header + whichever extension applies + documents + derived
 * fields (active projects, whether attendance is required for this type).
 */
@Getter
@Setter
public class WorkforceDetailView {

    private Workforce workforce;
    private Employee employee;      // null unless workforceType == EMPLOYEE
    private Contractor contractor;  // null unless workforceType == CONTRACTOR
    private List<WorkforceDocument> documents;
    private long activeProjects;
    private boolean attendanceRequired;
}

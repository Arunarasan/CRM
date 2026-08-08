package com.arudra.crm.dto.workforce;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Create/update payload for the unified "Add Workforce" flow. The shared fields populate the
 * {@code workforce} header; exactly one of {@link #employee} / {@link #contractor} is consumed,
 * chosen by {@link #workforceType}.
 */
@Getter
@Setter
public class WorkforceRequest {

    private String workforceType; // EMPLOYEE, CONTRACTOR, ...

    // --- Shared: basic ---
    private String fullName;
    private String profilePhotoUrl;
    private String mobile;
    private String email;
    private LocalDate dateOfBirth;
    private String gender;
    private String addressLine1;
    private String addressLine2;
    private String city;
    private String state;
    private String country;
    private String pincode;

    // --- Shared: identity ---
    private String aadhaarNumber;
    private String panNumber;
    private String drivingLicense;
    private String passportNumber;

    // --- Shared: emergency contact ---
    private String emergencyContactName;
    private String emergencyRelationship;
    private String emergencyPhone;

    // --- Shared: skills ---
    private String primarySkill;
    private String secondarySkills;
    private Integer experienceYears;
    private String certifications;

    // --- Shared: project info ---
    private LocalDate availableFrom;
    private String status;
    private String notes;

    private EmployeeDetails employee;
    private ContractorDetails contractor;

    @Getter
    @Setter
    public static class EmployeeDetails {
        private String employeeCode;
        private Long departmentId;
        private String designation;
        private LocalDate joiningDate;
        private BigDecimal salary;
        private String salaryType;
        private String shift;
        private Boolean attendanceRequired;
        private String leavePolicy;
        private Boolean payrollEnabled;
        private String pfNumber;
        private String esiNumber;
        private String bankAccount;
        private String ifsc;
        private String uan;
    }

    @Getter
    @Setter
    public static class ContractorDetails {
        private String companyName;
        private String contractorCode;
        private String contactPerson;
        private String gstNumber;
        private LocalDate contractStartDate;
        private LocalDate contractEndDate;
        private BigDecimal labourRate;
        private String paymentTerms;
        private String agreementNumber;
        private String serviceCategories;
        private Boolean tdsApplicable;
        private String insuranceDetails;
    }
}

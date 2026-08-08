package com.arudra.crm.service;

import com.arudra.crm.dto.workforce.WorkforceDetailView;
import com.arudra.crm.dto.workforce.WorkforceListRow;
import com.arudra.crm.dto.workforce.WorkforceRequest;
import com.arudra.crm.entity.*;
import com.arudra.crm.exception.ResourceNotFoundException;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * The unified master-data brain for the Workforce module. Owns the single "Add Workforce" flow, the
 * combined directory, the shared profile, and reporting. It keeps a {@link Workforce} header as the
 * source of truth for the ~90% of fields common to every workforce type, and delegates the
 * type-specific extension to the existing {@link HrService}/{@link ContractorService} so their rules
 * (auto-User provisioning, contractor code generation, opening balance) still run untouched.
 *
 * <p>Because existing module code reads {@code employee.firstName}/{@code contractor.name} directly,
 * the shared fields are mirrored onto the extension row on every write.
 */
@Service
public class WorkforceService {

    private static final Set<String> SUPPORTED = Set.of(ResourceType.EMPLOYEE, ResourceType.CONTRACTOR);

    @Autowired private WorkforceRepository workforceRepository;
    @Autowired private WorkforceDocumentRepository documentRepository;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private ContractorRepository contractorRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private ContractorProjectRepository contractorProjectRepository;
    @Autowired private TaskAssignmentRepository taskAssignmentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private HrService hrService;
    @Autowired private ContractorService contractorService;
    @Autowired private PayrollService payrollService;
    @Autowired private ContractorBillingService contractorBillingService;

    // ------------------------------------------------------------------ finance
    /**
     * Unified financial view for one workforce record — the same "one module, two workflows" idea as the
     * profile. EMPLOYEE → payroll (structure, payslip history, advances, loans). CONTRACTOR → the existing
     * contractor payment engine surfaced read-only (contract details, outstanding, bills = payment requests,
     * payment history, project-wise). Pure delegation; no money is computed here.
     */
    public Map<String, Object> finance(Long workforceId) {
        Workforce header = workforceRepository.findById(workforceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workforce not found: " + workforceId));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("workforceType", header.getWorkforceType());
        out.put("fullName", header.getFullName());

        if (ResourceType.EMPLOYEE.equals(header.getWorkforceType())) {
            Employee e = employeeRepository.findByWorkforceId(workforceId).orElse(null);
            if (e != null) {
                out.put("employeeId", e.getId());
                out.put("structure", payrollService.getStructure(e.getId()));
                out.put("payslips", payrollService.historyForEmployee(e.getId()));
                out.put("advances", payrollService.advancesForEmployee(e.getId()));
                out.put("loans", payrollService.loansForEmployee(e.getId()));
            }
        } else if (ResourceType.CONTRACTOR.equals(header.getWorkforceType())) {
            Contractor c = contractorRepository.findByWorkforceId(workforceId).orElse(null);
            if (c != null) {
                out.put("contractorId", c.getId());
                Map<String, Object> contract = new LinkedHashMap<>();
                contract.put("agreementNumber", c.getAgreementNumber());
                contract.put("contractStartDate", c.getAgreementStartDate());
                contract.put("contractEndDate", c.getAgreementEndDate());
                contract.put("paymentTerms", c.getPaymentTerms());
                contract.put("gstNumber", c.getGstin());
                contract.put("panNumber", c.getPan());
                out.put("contractDetails", contract);
                out.put("summary", contractorBillingService.getOutstanding(c.getId()));
                out.put("paymentRequests", contractorBillingService.getBillsForContractor(c.getId()));
                out.put("paymentHistory", contractorBillingService.getPaymentsForContractor(c.getId()));
                out.put("projectWise", contractorService.getProjectWisePayments(c.getId()));
            }
        }
        return out;
    }

    // ------------------------------------------------------------------ create
    @Transactional
    public WorkforceDetailView create(WorkforceRequest req) {
        String type = ResourceType.normalize(req.getWorkforceType());
        if (type == null || !SUPPORTED.contains(type)) {
            throw new IllegalArgumentException("Unsupported workforce type: " + req.getWorkforceType());
        }
        if (req.getFullName() == null || req.getFullName().isBlank()) {
            throw new IllegalArgumentException("Full name is required");
        }
        // Employees get a login User keyed by email, and employees.email is NOT NULL unique.
        if (ResourceType.EMPLOYEE.equals(type) && (req.getEmail() == null || req.getEmail().isBlank())) {
            throw new IllegalArgumentException("Email is required for an Employee");
        }

        Workforce header = new Workforce();
        header.setWorkforceType(type);
        applyHeader(header, req);
        header = workforceRepository.save(header);

        if (ResourceType.EMPLOYEE.equals(type)) {
            createEmployeeExtension(header, req);
        } else {
            createContractorExtension(header, req);
        }
        return get(header.getId());
    }

    private void createEmployeeExtension(Workforce header, WorkforceRequest req) {
        WorkforceRequest.EmployeeDetails d =
                req.getEmployee() != null ? req.getEmployee() : new WorkforceRequest.EmployeeDetails();
        Employee e = new Employee();
        mirrorEmployee(e, header, d);
        e.setEmployeeCode(d.getEmployeeCode() != null && !d.getEmployeeCode().isBlank()
                ? d.getEmployeeCode() : "EMP-" + (System.currentTimeMillis() % 1_000_000L));
        e.setDateOfJoining(d.getJoiningDate() != null ? d.getJoiningDate() : LocalDate.now());
        e.setStatus("ACTIVE");
        e.setWorkforce(header);
        hrService.createEmployee(e); // saves + auto-provisions the login User
    }

    private void createContractorExtension(Workforce header, WorkforceRequest req) {
        WorkforceRequest.ContractorDetails d =
                req.getContractor() != null ? req.getContractor() : new WorkforceRequest.ContractorDetails();
        Contractor c = new Contractor();
        mirrorContractor(c, header, d);
        if (d.getContractorCode() != null && !d.getContractorCode().isBlank()) {
            c.setContractorCode(d.getContractorCode()); // else ContractorService auto-generates
        }
        c.setStatus("ACTIVE");
        c.setWorkforce(header);
        contractorService.createContractor(c); // saves + code gen + opening balance
    }

    // ------------------------------------------------------------------ update
    @Transactional
    public WorkforceDetailView update(Long id, WorkforceRequest req) {
        Workforce header = workforceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Workforce not found: " + id));
        applyHeader(header, req);
        workforceRepository.save(header);

        if (ResourceType.EMPLOYEE.equals(header.getWorkforceType())) {
            Employee e = employeeRepository.findByWorkforceId(id).orElse(null);
            if (e != null) {
                mirrorEmployee(e, header,
                        req.getEmployee() != null ? req.getEmployee() : new WorkforceRequest.EmployeeDetails());
                employeeRepository.save(e);
            }
        } else if (ResourceType.CONTRACTOR.equals(header.getWorkforceType())) {
            Contractor c = contractorRepository.findByWorkforceId(id).orElse(null);
            if (c != null) {
                mirrorContractor(c, header,
                        req.getContractor() != null ? req.getContractor() : new WorkforceRequest.ContractorDetails());
                contractorRepository.save(c);
            }
        }
        return get(id);
    }

    // ------------------------------------------------------------------ read
    public List<WorkforceListRow> list(String type, String skill, String status,
                                       String department, String company, String search) {
        String t = blankToNull(type);
        List<Workforce> headers = workforceRepository.filter(
                t == null ? null : ResourceType.normalize(t),
                blankToNull(status), blankToNull(skill), blankToNull(search));

        List<WorkforceListRow> rows = new ArrayList<>();
        String deptFilter = blankToNull(department);
        String companyFilter = blankToNull(company);

        for (Workforce w : headers) {
            WorkforceListRow row = new WorkforceListRow();
            row.setId(w.getId());
            row.setWorkforceType(w.getWorkforceType());
            row.setFullName(w.getFullName());
            row.setPrimarySkill(w.getPrimarySkill());
            row.setStatus(w.getStatus());
            row.setMobile(w.getMobile());
            row.setEmail(w.getEmail());
            row.setProfilePhotoUrl(w.getProfilePhotoUrl());

            if (ResourceType.EMPLOYEE.equals(w.getWorkforceType())) {
                Employee e = employeeRepository.findByWorkforceId(w.getId()).orElse(null);
                if (e != null) {
                    row.setEmployeeId(e.getId());
                    if (e.getDepartment() != null) row.setDepartment(e.getDepartment().getName());
                    row.setActiveProjects(activeProjectsForEmployee(w.getEmail()));
                }
                if (deptFilter != null && (row.getDepartment() == null
                        || !row.getDepartment().equalsIgnoreCase(deptFilter))) continue;
                if (companyFilter != null) continue; // company filter excludes employees
            } else if (ResourceType.CONTRACTOR.equals(w.getWorkforceType())) {
                Contractor c = contractorRepository.findByWorkforceId(w.getId()).orElse(null);
                if (c != null) {
                    row.setContractorId(c.getId());
                    row.setCompanyName(c.getCompanyName());
                    row.setActiveProjects(activeProjectsForContractor(c.getId()));
                }
                if (companyFilter != null && (row.getCompanyName() == null
                        || !row.getCompanyName().toLowerCase().contains(companyFilter.toLowerCase()))) continue;
                if (deptFilter != null) continue; // department filter excludes contractors
            }
            rows.add(row);
        }
        return rows;
    }

    public WorkforceDetailView get(Long id) {
        Workforce header = workforceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Workforce not found: " + id));
        WorkforceDetailView view = new WorkforceDetailView();
        view.setWorkforce(header);
        view.setDocuments(documentRepository.findByWorkforceIdAndIsDeletedFalseOrderByCreatedAtDesc(id));
        view.setAttendanceRequired(attendanceRequired(header));

        if (ResourceType.EMPLOYEE.equals(header.getWorkforceType())) {
            Employee e = employeeRepository.findByWorkforceId(id).orElse(null);
            view.setEmployee(e);
            view.setActiveProjects(activeProjectsForEmployee(header.getEmail()));
        } else if (ResourceType.CONTRACTOR.equals(header.getWorkforceType())) {
            Contractor c = contractorRepository.findByWorkforceId(id).orElse(null);
            view.setContractor(c);
            if (c != null) view.setActiveProjects(activeProjectsForContractor(c.getId()));
        }
        return view;
    }

    // --------------------------------------------------------------- documents
    @Transactional
    public WorkforceDocument addDocument(Long workforceId, WorkforceDocument doc) {
        Workforce header = workforceRepository.findById(workforceId)
                .orElseThrow(() -> new ResourceNotFoundException("Workforce not found: " + workforceId));
        doc.setId(null);
        doc.setWorkforce(header);
        return documentRepository.save(doc);
    }

    public List<WorkforceDocument> listDocuments(Long workforceId) {
        return documentRepository.findByWorkforceIdAndIsDeletedFalseOrderByCreatedAtDesc(workforceId);
    }

    // -------------------------------------------------------------------- meta
    public Map<String, Object> meta() {
        Map<String, Object> m = new LinkedHashMap<>();
        // Only types with a real extension today are creatable; the rest are reserved (future-ready).
        m.put("types", List.of(
                Map.of("value", ResourceType.EMPLOYEE, "label", "Employee", "creatable", true),
                Map.of("value", ResourceType.CONTRACTOR, "label", "Contractor", "creatable", true),
                Map.of("value", ResourceType.FREELANCER, "label", "Freelancer", "creatable", false),
                Map.of("value", ResourceType.CONSULTANT, "label", "Consultant", "creatable", false),
                Map.of("value", ResourceType.VENDOR, "label", "Vendor Technician", "creatable", false)));
        m.put("statuses", List.of("AVAILABLE", "BUSY", "ON_LEAVE", "INACTIVE"));
        m.put("skills", List.of("Carpenter", "Electrician", "Painter", "Aluminium Fabricator",
                "Site Engineer", "Plumber", "Tile Layer", "Civil", "HVAC", "Glass Installer"));
        m.put("salaryTypes", List.of("MONTHLY", "DAILY", "HOURLY"));
        m.put("departments", departmentRepository.findAll());
        return m;
    }

    // ----------------------------------------------------------------- reports
    /**
     * Aggregated workforce reports. Kept intentionally simple and derived from the same masters the
     * directory reads, so adding a report type is one branch here + one entry in the frontend.
     */
    public Map<String, Object> report(String type) {
        List<WorkforceListRow> all = list(null, null, null, null, null, null);
        Map<String, Object> out = new LinkedHashMap<>();
        String r = type == null ? "" : type.toLowerCase();
        switch (r) {
            case "skills-matrix": {
                Map<String, Long> bySkill = new TreeMap<>();
                for (WorkforceListRow w : all) {
                    String s = w.getPrimarySkill() != null ? w.getPrimarySkill() : "Unspecified";
                    bySkill.merge(s, 1L, Long::sum);
                }
                out.put("bySkill", bySkill);
                break;
            }
            case "active-workforce":
            case "workforce-availability": {
                Map<String, Long> byStatus = new TreeMap<>();
                for (WorkforceListRow w : all) byStatus.merge(w.getStatus(), 1L, Long::sum);
                out.put("byStatus", byStatus);
                out.put("available", all.stream().filter(w -> "AVAILABLE".equals(w.getStatus())).count());
                break;
            }
            case "workforce-utilization": {
                out.put("rows", all.stream().map(w -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", w.getFullName());
                    m.put("type", w.getWorkforceType());
                    m.put("activeProjects", w.getActiveProjects());
                    m.put("status", w.getStatus());
                    return m;
                }).toList());
                break;
            }
            default: {
                long employees = all.stream().filter(w -> ResourceType.EMPLOYEE.equals(w.getWorkforceType())).count();
                long contractors = all.stream().filter(w -> ResourceType.CONTRACTOR.equals(w.getWorkforceType())).count();
                out.put("total", all.size());
                out.put("employees", employees);
                out.put("contractors", contractors);
            }
        }
        return out;
    }

    // ----------------------------------------------------------------- helpers
    private void applyHeader(Workforce h, WorkforceRequest r) {
        h.setFullName(r.getFullName());
        h.setProfilePhotoUrl(r.getProfilePhotoUrl());
        h.setMobile(r.getMobile());
        h.setEmail(r.getEmail());
        h.setDateOfBirth(r.getDateOfBirth());
        h.setGender(r.getGender());
        h.setAddressLine1(r.getAddressLine1());
        h.setAddressLine2(r.getAddressLine2());
        h.setCity(r.getCity());
        h.setState(r.getState());
        h.setCountry(r.getCountry());
        h.setPincode(r.getPincode());
        h.setAadhaarNumber(r.getAadhaarNumber());
        h.setPanNumber(r.getPanNumber());
        h.setDrivingLicense(r.getDrivingLicense());
        h.setPassportNumber(r.getPassportNumber());
        h.setEmergencyContactName(r.getEmergencyContactName());
        h.setEmergencyRelationship(r.getEmergencyRelationship());
        h.setEmergencyPhone(r.getEmergencyPhone());
        h.setPrimarySkill(r.getPrimarySkill());
        h.setSecondarySkills(r.getSecondarySkills());
        h.setExperienceYears(r.getExperienceYears());
        h.setCertifications(r.getCertifications());
        h.setAvailableFrom(r.getAvailableFrom());
        if (r.getStatus() != null && !r.getStatus().isBlank()) h.setStatus(r.getStatus());
        h.setNotes(r.getNotes());
    }

    /** Copy shared header fields + employee-specific fields onto the Employee extension row. */
    private void mirrorEmployee(Employee e, Workforce h, WorkforceRequest.EmployeeDetails d) {
        String[] name = splitName(h.getFullName());
        e.setFirstName(name[0]);
        e.setLastName(name[1]);
        e.setEmail(h.getEmail());
        e.setPhone(h.getMobile());
        e.setProfilePhotoUrl(h.getProfilePhotoUrl());
        e.setEmergencyContactName(h.getEmergencyContactName());
        e.setEmergencyContactPhone(h.getEmergencyPhone());
        if (d.getDesignation() != null) e.setDesignation(d.getDesignation());
        if (d.getDepartmentId() != null) {
            departmentRepository.findById(d.getDepartmentId()).ifPresent(e::setDepartment);
        }
        if (d.getJoiningDate() != null) e.setDateOfJoining(d.getJoiningDate());
        if (d.getSalary() != null) e.setBaseSalary(d.getSalary());
        e.setSalaryType(d.getSalaryType());
        e.setShift(d.getShift());
        if (d.getAttendanceRequired() != null) e.setAttendanceRequired(d.getAttendanceRequired());
        e.setLeavePolicy(d.getLeavePolicy());
        if (d.getPayrollEnabled() != null) e.setPayrollEnabled(d.getPayrollEnabled());
        e.setPfNumber(d.getPfNumber());
        e.setEsiNumber(d.getEsiNumber());
        e.setBankAccount(d.getBankAccount());
        e.setIfsc(d.getIfsc());
        e.setUan(d.getUan());
    }

    /** Copy shared header fields + contractor-specific fields onto the Contractor extension row. */
    private void mirrorContractor(Contractor c, Workforce h, WorkforceRequest.ContractorDetails d) {
        c.setName(h.getFullName());
        c.setEmail(h.getEmail());
        c.setPhone(h.getMobile());
        c.setPan(h.getPanNumber());
        c.setAddressLine1(h.getAddressLine1());
        c.setAddressLine2(h.getAddressLine2());
        c.setCity(h.getCity());
        c.setState(h.getState());
        c.setPincode(h.getPincode());
        if (h.getPrimarySkill() != null) c.setTrade(h.getPrimarySkill());
        c.setSkills(h.getSecondarySkills());
        c.setCompanyName(d.getCompanyName());
        c.setContactPerson(d.getContactPerson());
        c.setGstin(d.getGstNumber());
        c.setAgreementStartDate(d.getContractStartDate());
        c.setAgreementEndDate(d.getContractEndDate());
        if (d.getLabourRate() != null) c.setDailyRate(d.getLabourRate());
        c.setPaymentTerms(d.getPaymentTerms());
        c.setAgreementNumber(d.getAgreementNumber());
        if (d.getServiceCategories() != null) c.setTrades(d.getServiceCategories());
        c.setTdsApplicable(d.getTdsApplicable());
        c.setInsuranceNumber(d.getInsuranceDetails());
    }

    /** attendance defaults on for employees; contractors are opt-in (future system setting). */
    private boolean attendanceRequired(Workforce w) {
        return ResourceType.EMPLOYEE.equals(w.getWorkforceType());
    }

    private long activeProjectsForEmployee(String email) {
        if (email == null || email.isBlank()) return 0;
        return userRepository.findByEmail(email)
                .map(u -> taskAssignmentRepository.countActiveProjectsForResource(ResourceType.EMPLOYEE, u.getId()))
                .orElse(0L);
    }

    private long activeProjectsForContractor(Long contractorId) {
        return contractorProjectRepository.findByContractorId(contractorId).stream()
                .filter(cp -> !"COMPLETED".equalsIgnoreCase(cp.getStatus()))
                .map(cp -> cp.getProject() != null ? cp.getProject().getId() : null)
                .filter(Objects::nonNull)
                .distinct()
                .count();
    }

    private static String[] splitName(String full) {
        String v = full == null ? "" : full.trim();
        int sp = v.indexOf(' ');
        if (sp < 0) return new String[]{v.isEmpty() ? "-" : v, "-"};
        return new String[]{v.substring(0, sp), v.substring(sp + 1).trim()};
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}

package com.arudra.crm.service;

import com.arudra.crm.annotation.LogActivity;
import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeDocument;
import com.arudra.crm.entity.ProfileChangeRequest;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.EmployeeDocumentRepository;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.ProfileChangeRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * The approval gate between an employee's self-service edits and their master record. An employee
 * raises a {@link ProfileChangeRequest} from the portal (profile fields or a document); nothing on
 * the {@link Employee} changes until an admin approves it here. Mirrors the PayrollRequest
 * "employee raises → admin approves" pattern.
 */
@Service
public class ProfileChangeRequestService {

    @Autowired private ProfileChangeRequestRepository requestRepository;
    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private EmployeeDocumentRepository documentRepository;
    @Autowired private NotificationService notificationService;

    /** Resolves the employee behind the signed-in user (linked by shared email), or fails loudly. */
    private Employee requireEmployee(User currentUser) {
        if (currentUser == null) {
            throw new IllegalStateException("Not authenticated.");
        }
        return employeeRepository.findByEmailIgnoreCaseAndIsDeletedFalse(currentUser.getEmail())
                .orElseThrow(() -> new IllegalStateException(
                        "This login is not linked to an employee record."));
    }

    // =====================================================================
    // Create (employee-facing)
    // =====================================================================

    /**
     * Raises a PROFILE change request from the portal. Only the four self-editable fields are read;
     * blanks are ignored so an unchanged field is left null (nothing to apply on approval). The
     * employee + requester are server-set from the security context, never trusted from the body.
     */
    @LogActivity(module = "EMPLOYEE_PORTAL", action = "PROFILE_CHANGE_REQUEST")
    @Transactional
    public ProfileChangeRequest createProfileChange(User currentUser, Map<String, String> body) {
        Employee employee = requireEmployee(currentUser);
        ProfileChangeRequest r = new ProfileChangeRequest();
        r.setEmployee(employee);
        r.setRequestedBy(currentUser);
        r.setChangeType("PROFILE");
        r.setProposedPhone(trimToNull(body.get("phone")));
        r.setProposedEmergencyName(trimToNull(body.get("emergencyContactName")));
        r.setProposedEmergencyPhone(trimToNull(body.get("emergencyContactPhone")));
        r.setProposedPhotoUrl(trimToNull(body.get("profilePhotoUrl")));
        if (r.getProposedPhone() == null && r.getProposedEmergencyName() == null
                && r.getProposedEmergencyPhone() == null && r.getProposedPhotoUrl() == null) {
            throw new IllegalArgumentException("Nothing to submit — no changes were entered.");
        }
        r.setStatus("PENDING");
        ProfileChangeRequest saved = requestRepository.save(r);
        notifyAdmins(currentUser, employee, "Profile Change Request",
                fullName(employee) + " submitted profile changes for approval.");
        return saved;
    }

    /** Raises a DOCUMENT request from the portal (a document the employee wants added to their file). */
    @LogActivity(module = "EMPLOYEE_PORTAL", action = "DOCUMENT_REQUEST")
    @Transactional
    public ProfileChangeRequest createDocumentRequest(User currentUser, Map<String, String> body) {
        Employee employee = requireEmployee(currentUser);
        String name = trimToNull(body.get("documentName"));
        String type = trimToNull(body.get("documentType"));
        String url = trimToNull(body.get("fileUrl"));
        if (name == null) throw new IllegalArgumentException("Document name is required.");
        if (type == null) throw new IllegalArgumentException("Document type is required.");
        if (url == null) throw new IllegalArgumentException("Please attach the document file.");

        ProfileChangeRequest r = new ProfileChangeRequest();
        r.setEmployee(employee);
        r.setRequestedBy(currentUser);
        r.setChangeType("DOCUMENT");
        r.setDocName(name);
        r.setDocType(type);
        r.setDocFileUrl(url);
        r.setStatus("PENDING");
        ProfileChangeRequest saved = requestRepository.save(r);
        notifyAdmins(currentUser, employee, "Document Approval",
                fullName(employee) + " submitted a document (" + name + ") for approval.");
        return saved;
    }

    // =====================================================================
    // Read
    // =====================================================================

    /** The signed-in employee's own change requests, latest first. */
    public List<ProfileChangeRequest> listMine(User currentUser) {
        Employee employee = requireEmployee(currentUser);
        return requestRepository.findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(employee.getId());
    }

    /** All change requests for one employee (admin inline panel). */
    public List<ProfileChangeRequest> listForEmployee(Long employeeId) {
        return requestRepository.findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(employeeId);
    }

    /** The admin review queue — all requests, or filtered by status when given. */
    public List<ProfileChangeRequest> listForAdmin(String status) {
        return (status == null || status.isBlank())
                ? requestRepository.findByIsDeletedFalseOrderByIdDesc()
                : requestRepository.findByStatusAndIsDeletedFalseOrderByIdDesc(status.trim().toUpperCase());
    }

    // =====================================================================
    // Approve / Reject (admin-facing)
    // =====================================================================

    /**
     * Approves a pending request and applies it: PROFILE copies the non-null proposed fields onto the
     * employee; DOCUMENT creates an {@link EmployeeDocument}. The requesting employee is notified.
     */
    @LogActivity(module = "HR", action = "PROFILE_CHANGE_APPROVE")
    @Transactional
    public ProfileChangeRequest approve(Long id, User admin) {
        ProfileChangeRequest r = require(id);
        Employee employee = r.getEmployee();
        if ("PROFILE".equals(r.getChangeType())) {
            if (r.getProposedPhone() != null) employee.setPhone(r.getProposedPhone());
            if (r.getProposedEmergencyName() != null) employee.setEmergencyContactName(r.getProposedEmergencyName());
            if (r.getProposedEmergencyPhone() != null) employee.setEmergencyContactPhone(r.getProposedEmergencyPhone());
            if (r.getProposedPhotoUrl() != null) employee.setProfilePhotoUrl(r.getProposedPhotoUrl());
            employeeRepository.save(employee);
        } else if ("DOCUMENT".equals(r.getChangeType())) {
            EmployeeDocument doc = new EmployeeDocument();
            doc.setEmployee(employee);
            doc.setDocumentName(r.getDocName());
            doc.setDocumentType(r.getDocType());
            doc.setFileUrl(r.getDocFileUrl());
            doc.setUploadedDate(LocalDate.now());
            documentRepository.save(doc);
        }
        r.setStatus("APPROVED");
        r.setReviewedBy(admin);
        r.setReviewedAt(LocalDateTime.now());
        ProfileChangeRequest saved = requestRepository.save(r);
        notifyRequester(r, "Change Approved",
                ("DOCUMENT".equals(r.getChangeType()) ? "Your document was" : "Your profile changes were")
                        + " approved.");
        return saved;
    }

    /** Rejects a pending request with optional remarks; nothing on the employee changes. */
    @LogActivity(module = "HR", action = "PROFILE_CHANGE_REJECT")
    @Transactional
    public ProfileChangeRequest reject(Long id, User admin, String remarks) {
        ProfileChangeRequest r = require(id);
        r.setStatus("REJECTED");
        r.setReviewRemarks(trimToNull(remarks));
        r.setReviewedBy(admin);
        r.setReviewedAt(LocalDateTime.now());
        ProfileChangeRequest saved = requestRepository.save(r);
        notifyRequester(r, "Change Rejected",
                ("DOCUMENT".equals(r.getChangeType()) ? "Your document was" : "Your profile changes were")
                        + " rejected." + (r.getReviewRemarks() != null ? " Reason: " + r.getReviewRemarks() : ""));
        return saved;
    }

    private ProfileChangeRequest require(Long id) {
        ProfileChangeRequest r = requestRepository.findById(id)
                .orElseThrow(() -> new IllegalStateException("Request not found."));
        if (Boolean.TRUE.equals(r.getIsDeleted())) {
            throw new IllegalStateException("Request not found.");
        }
        if (!"PENDING".equals(r.getStatus())) {
            throw new IllegalStateException("This request has already been " + r.getStatus().toLowerCase() + ".");
        }
        return r;
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private void notifyAdmins(User actor, Employee employee, String title, String message) {
        notificationService.dispatchToAdmins(title, message, "PROFILE_CHANGE_REQUEST",
                "/hr/employees/" + employee.getId(), actor != null ? actor.getId() : null);
    }

    private void notifyRequester(ProfileChangeRequest r, String title, String message) {
        if (r.getRequestedBy() != null) {
            notificationService.dispatch(title, message, "PROFILE_CHANGE_DECISION",
                    r.getRequestedBy().getId(), "/employee/more");
        }
    }

    private static String fullName(Employee e) {
        String first = e.getFirstName() == null ? "" : e.getFirstName();
        String last = e.getLastName() == null ? "" : e.getLastName();
        String name = (first + " " + last).trim();
        return name.isEmpty() ? "An employee" : name;
    }

    private static String trimToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}

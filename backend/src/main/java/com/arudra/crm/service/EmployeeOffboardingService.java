package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Clean-up when an employee is deactivated or deleted, so admin doesn't have to chase leftovers:
 * open tasks go back to the shared pool (unassigned), the employee's unread notifications are cleared,
 * and approvals they raised that no longer make sense (leave, attendance correction, profile change)
 * are closed. Money-bearing requests (payroll advances, project conversions) are never auto-closed —
 * they are only counted so admin can settle them.
 */
@Service
public class EmployeeOffboardingService {

    /** Assignment statuses that mean "still on the employee's plate". WAITING_APPROVAL stays for admin. */
    private static final Set<String> OPEN_ASSIGNMENT = Set.of(
            "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "PAUSED", "WAITING_MATERIAL", "REWORK");

    private static final String NOTE = "Auto-closed: employee is no longer active";

    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private EmployeeTaskService employeeTaskService;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private LeaveRequestRepository leaveRequestRepository;
    @Autowired private AttendanceCorrectionRequestRepository correctionRepository;
    @Autowired private ProfileChangeRequestRepository profileChangeRepository;
    @Autowired private PayrollRequestRepository payrollRequestRepository;
    @Autowired private ProjectConversionRequestRepository conversionRepository;

    /** What would happen — shown in the confirm dialog. Changes nothing. */
    @Transactional(readOnly = true)
    public Map<String, Object> preview(Employee e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("openTasks", openAssignments(e).size());
        m.put("unreadNotifications", e.getUserId() == null ? 0
                : notificationRepository.findByRecipientIdAndIsReadFalse(e.getUserId()).size());
        m.put("leaveRequests", leaveRequestRepository.findByEmployeeIdAndStatus(e.getId(), "PENDING").size());
        m.put("correctionRequests",
                correctionRepository.findByEmployeeIdAndStatusAndIsDeletedFalse(e.getId(), "PENDING").size());
        m.put("profileRequests",
                profileChangeRepository.findByEmployeeIdAndStatusAndIsDeletedFalse(e.getId(), "PENDING").size());
        m.put("payrollRequestsNeedAdmin",
                payrollRequestRepository.countByEmployeeIdAndStatusAndIsDeletedFalse(e.getId(), "PENDING"));
        m.put("conversionRequestsNeedAdmin", e.getUserId() == null ? 0L
                : conversionRepository.countByRequestedByIdAndStatusAndIsDeletedFalse(
                        e.getUserId(), ProjectConversionRequest.PENDING));
        return m;
    }

    /** Runs the clean-up inside the caller's transaction (so a failed delete rolls it back too). */
    @Transactional
    public Map<String, Object> offboard(Employee e) {
        Map<String, Object> summary = preview(e);

        // 1. Open tasks → back to the pool, unassigned.
        for (TaskAssignment a : openAssignments(e)) {
            Long taskId = a.getTask().getId();
            employeeTaskService.removeResourceAssignment(taskId, ResourceType.EMPLOYEE, a.getResourceId());
            Task task = taskRepository.findById(taskId).orElse(null);
            if (task == null || "COMPLETED".equals(task.getStatus()) || "CANCELLED".equals(task.getStatus())) continue;
            boolean stillHeld = assignmentRepository.findByTaskId(taskId).stream()
                    .anyMatch(x -> !"CANCELLED".equals(x.getStatus()) && !"REJECTED".equals(x.getStatus()));
            if (!stillHeld) {
                // Same pool states the board reads: work tasks wait PENDING, workflow tasks AVAILABLE.
                task.setStatus(isWorkTask(task) ? "PENDING" : "AVAILABLE");
                taskRepository.save(task);
            }
        }

        // 2. Their notifications are of no use now.
        if (e.getUserId() != null) {
            List<Notification> unread = notificationRepository.findByRecipientIdAndIsReadFalse(e.getUserId());
            unread.forEach(n -> n.setRead(true));
            notificationRepository.saveAll(unread);
        }

        // 3. Approvals they raised that nobody should act on any more.
        LocalDateTime now = LocalDateTime.now();
        for (LeaveRequest r : leaveRequestRepository.findByEmployeeIdAndStatus(e.getId(), "PENDING")) {
            r.setStatus("REJECTED");
            r.setApprovedBy(NOTE);
            leaveRequestRepository.save(r);
        }
        for (AttendanceCorrectionRequest r :
                correctionRepository.findByEmployeeIdAndStatusAndIsDeletedFalse(e.getId(), "PENDING")) {
            r.setStatus("REJECTED");
            r.setReviewRemarks(NOTE);
            r.setReviewedAt(now);
            correctionRepository.save(r);
        }
        for (ProfileChangeRequest r :
                profileChangeRepository.findByEmployeeIdAndStatusAndIsDeletedFalse(e.getId(), "PENDING")) {
            r.setStatus("REJECTED");
            r.setReviewRemarks(NOTE);
            r.setReviewedAt(now);
            profileChangeRepository.save(r);
        }

        // 4. One summary for admin, only when something happened or needs them.
        int cleaned = (int) summary.get("openTasks") + (int) summary.get("leaveRequests")
                + (int) summary.get("correctionRequests") + (int) summary.get("profileRequests");
        long needAdmin = (long) summary.get("payrollRequestsNeedAdmin") + (long) summary.get("conversionRequestsNeedAdmin");
        if (cleaned > 0 || needAdmin > 0) {
            String name = ((e.getFirstName() == null ? "" : e.getFirstName()) + " "
                    + (e.getLastName() == null ? "" : e.getLastName())).trim();
            StringBuilder msg = new StringBuilder(name).append(" is no longer active: ")
                    .append(summary.get("openTasks")).append(" task(s) released to the pool, ")
                    .append((int) summary.get("leaveRequests") + (int) summary.get("correctionRequests")
                            + (int) summary.get("profileRequests")).append(" pending request(s) closed.");
            if (needAdmin > 0) msg.append(" ").append(needAdmin).append(" payroll/conversion request(s) still need your decision.");
            notificationService.dispatchToAdmins("Employee offboarded", msg.toString(), "SYSTEM", "/tasks", null);
        }
        return summary;
    }

    private List<TaskAssignment> openAssignments(Employee e) {
        if (e.getUserId() == null) return List.of();
        return assignmentRepository.findByResourceTypeAndResourceId(ResourceType.EMPLOYEE, e.getUserId()).stream()
                .filter(a -> OPEN_ASSIGNMENT.contains(a.getStatus()))
                .filter(a -> !"COMPLETED".equals(a.getTask().getStatus()) && !"CANCELLED".equals(a.getTask().getStatus()))
                .toList();
    }

    private boolean isWorkTask(Task t) {
        String source = t.getSource() == null ? "" : t.getSource().toUpperCase();
        return t.getLeadId() == null
                && (t.getProject() != null || t.getInvoiceId() != null
                    || "BUNDLE".equals(source) || "SERVICE_REQUEST".equals(source));
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * An employee on a task reports that the customer cancelled (or another problem) and asks to cancel the
 * work. Nothing changes until an admin approves: then the lead is marked Lost, the project is cancelled,
 * or - for a task with neither - the task itself is cancelled.
 */
@Service
public class TaskCancelRequestService {

    public static final Set<String> REASON_CODES = Set.of("CUSTOMER_CANCELLED", "OTHER_ISSUE");

    @Autowired private TaskCancelRequestRepository repository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private LeadRepository leadRepository;
    @Autowired private LeadService leadService;
    @Autowired private ProjectCancellationService projectCancellationService;
    @Autowired private NotificationService notificationService;

    private static boolean isAdmin(User u) {
        return u != null && u.getRoles() != null && u.getRoles().stream()
                .anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getName()));
    }

    private boolean onTask(Long taskId, Long userId) {
        return assignmentRepository.findByTaskId(taskId).stream().anyMatch(a ->
                !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus())
                        && a.getEmployee() != null && userId.equals(a.getEmployee().getId()));
    }

    private static String targetLabel(TaskCancelRequest r) {
        return switch (r.getTargetType()) {
            case "LEAD" -> "mark the lead as Lost";
            case "PROJECT" -> "cancel the project";
            default -> "cancel the task";
        };
    }

    @Transactional
    public Map<String, Object> request(Long taskId, User user, String reasonCode, String reason) {
        Task task = taskRepository.findById(taskId).orElseThrow(() -> new IllegalArgumentException("Task not found"));
        if ("COMPLETED".equals(task.getStatus()) || "CANCELLED".equals(task.getStatus())) {
            throw new IllegalStateException("This task is already closed.");
        }
        if (!isAdmin(user) && !onTask(taskId, user.getId())) {
            throw new IllegalStateException("Only someone working on this task can ask to cancel it.");
        }
        String code = reasonCode == null ? "" : reasonCode.trim().toUpperCase();
        if (!REASON_CODES.contains(code)) throw new IllegalArgumentException("Choose why it is being cancelled.");
        String why = reason == null ? "" : reason.trim();
        if (why.isEmpty()) throw new IllegalArgumentException("Write what happened.");
        if (why.length() > 1000) why = why.substring(0, 1000);
        if (repository.findFirstByTaskIdAndStatus(taskId, "PENDING").isPresent()) {
            throw new IllegalStateException("A cancel request for this task is already waiting for admin approval.");
        }

        TaskCancelRequest r = new TaskCancelRequest();
        r.setTask(task);
        r.setRequester(user);
        r.setReasonCode(code);
        r.setReason(why);
        if (task.getProject() != null) {
            String ps = task.getProject().getStatus() == null ? "" : task.getProject().getStatus().toUpperCase();
            if (Set.of("COMPLETED", "CLOSED", "CANCELLED").contains(ps)) {
                throw new IllegalStateException("This project is already " + ps.toLowerCase() + ".");
            }
            r.setTargetType("PROJECT");
            r.setProjectId(task.getProject().getId());
        } else if (task.getLeadId() != null) {
            Lead lead = leadRepository.findById(task.getLeadId()).orElse(null);
            if (lead != null && "Lost".equalsIgnoreCase(lead.getStatus())) {
                throw new IllegalStateException("This lead is already marked Lost.");
            }
            r.setTargetType("LEAD");
            r.setLeadId(task.getLeadId());
        } else {
            r.setTargetType("TASK");
        }
        TaskCancelRequest saved = repository.save(r);

        notificationService.dispatchToAdmins("Cancel request",
                user.getName() + " asked to " + targetLabel(saved) + " (\"" + task.getTaskName() + "\"): " + why,
                "TASK", "/tasks?tab=cancels", user.getId());
        return toMap(saved);
    }

    public List<Map<String, Object>> pending() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (TaskCancelRequest r : repository.findByStatusOrderByIdAsc("PENDING")) out.add(toMap(r));
        return out;
    }

    public long pendingCount() {
        return repository.countByStatus("PENDING");
    }

    /** The task's waiting request, if any - lets the task page show "waiting for admin". */
    public Map<String, Object> pendingForTask(Long taskId) {
        return repository.findFirstByTaskIdAndStatus(taskId, "PENDING").map(this::toMap).orElse(null);
    }

    @Transactional
    public Map<String, Object> approve(Long id, User admin) {
        TaskCancelRequest r = load(id);
        String reason = (r.getReasonCode().equals("CUSTOMER_CANCELLED") ? "Customer cancelled: " : "Cancelled: ") + r.getReason();
        switch (r.getTargetType()) {
            case "LEAD" -> leadService.markAsLost(r.getLeadId(), reason, null,
                    "Requested by " + r.getRequester().getName() + " from a task", admin);
            case "PROJECT" -> {
                ProjectCancellationService.CancelRequest cr = new ProjectCancellationService.CancelRequest();
                cr.reason = reason;
                projectCancellationService.cancel(r.getProjectId(), cr, admin);
            }
            default -> {
                Task t = r.getTask();
                t.setStatus("CANCELLED");
                taskRepository.save(t);
                for (TaskAssignment a : assignmentRepository.findByTaskId(t.getId())) {
                    if (!"COMPLETED".equals(a.getStatus())) {
                        a.setStatus("CANCELLED");
                        assignmentRepository.save(a);
                    }
                }
            }
        }
        r.setStatus("APPROVED");
        r.setDecidedBy(admin);
        r.setDecidedAt(LocalDateTime.now());
        repository.save(r);
        notificationService.dispatch("Cancel request approved",
                "Approved: " + targetLabel(r) + " (\"" + r.getTask().getTaskName() + "\").", "TASK",
                r.getRequester().getId(), "/employee/tasks");
        return toMap(r);
    }

    @Transactional
    public Map<String, Object> reject(Long id, User admin, String note) {
        TaskCancelRequest r = load(id);
        r.setStatus("REJECTED");
        r.setDecidedBy(admin);
        r.setDecidedAt(LocalDateTime.now());
        String n = note == null ? "" : note.trim();
        r.setDecisionNote(n.isEmpty() ? null : n.substring(0, Math.min(500, n.length())));
        repository.save(r);
        notificationService.dispatch("Cancel request declined",
                "Your request to " + targetLabel(r) + " (\"" + r.getTask().getTaskName() + "\") was declined"
                        + (r.getDecisionNote() != null ? ": " + r.getDecisionNote() : "."), "TASK",
                r.getRequester().getId(), "/employee/tasks/" + r.getTask().getId());
        return toMap(r);
    }

    private TaskCancelRequest load(Long id) {
        TaskCancelRequest r = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("Request not found"));
        if (!"PENDING".equals(r.getStatus())) throw new IllegalStateException("This request was already handled.");
        return r;
    }

    private Map<String, Object> toMap(TaskCancelRequest r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("status", r.getStatus());
        m.put("targetType", r.getTargetType());
        m.put("reasonCode", r.getReasonCode());
        m.put("reason", r.getReason());
        m.put("taskId", r.getTask().getId());
        m.put("taskName", r.getTask().getTaskName());
        m.put("requesterName", r.getRequester().getName());
        m.put("leadId", r.getLeadId());
        m.put("projectId", r.getProjectId());
        if (r.getLeadId() != null) {
            leadRepository.findById(r.getLeadId()).ifPresent(l -> m.put("leadName", l.getName()));
        }
        if (r.getProjectId() != null && r.getTask().getProject() != null) {
            m.put("projectName", r.getTask().getProject().getProjectName());
        }
        m.put("requestedAt", r.getCreatedAt());
        m.put("decisionNote", r.getDecisionNote());
        return m;
    }
}

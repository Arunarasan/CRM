package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * What an employee has worked on, for the admin profile's Work tab: their assigned and finished
 * tasks split into Leads, Projects and Orders. "Assigned" is always everything still open; the
 * from/to window applies only to finished work. The employee is linked to their login (which owns
 * TaskAssignments) by email, as in {@link PayrollService#employeeWorkStats}.
 */
@Service
public class EmployeeWorkService {

    @Autowired private EmployeeRepository employeeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private TaskAssignmentRepository taskAssignmentRepository;
    @Autowired private LeadRepository leadRepository;
    @Autowired private BundleRepository bundleRepository;
    @Autowired private CustomerRepository customerRepository;

    private static final Set<String> DEAD = Set.of("CANCELLED", "REJECTED");

    @Transactional(readOnly = true)
    public Map<String, Object> work(Long employeeId, LocalDate from, LocalDate to) {
        Map<String, List<Map<String, Object>>> assigned = emptyGroups();
        Map<String, List<Map<String, Object>>> done = emptyGroups();

        Employee emp = employeeRepository.findById(employeeId).orElse(null);
        User user = emp != null && emp.getEmail() != null ? userRepository.findByEmail(emp.getEmail()).orElse(null) : null;
        if (user != null) {
            LocalDate today = LocalDate.now();
            List<TaskAssignment> mine = taskAssignmentRepository.findByEmployeeId(user.getId());
            Set<Long> taskIds = new HashSet<>();
            for (TaskAssignment a : mine) if (a.getTask() != null) taskIds.add(a.getTask().getId());

            // Orders: bundles assigned directly, or whose stitching / install task is assigned to them.
            Map<Long, Bundle> bundles = new LinkedHashMap<>();
            bundleRepository.findByIsDeletedFalseAndResourceTypeAndResourceId("EMPLOYEE", user.getId())
                    .forEach(b -> bundles.put(b.getId(), b));
            if (!taskIds.isEmpty()) {
                bundleRepository.findByIsDeletedFalseAndTaskIdIn(taskIds).forEach(b -> bundles.put(b.getId(), b));
                bundleRepository.findByIsDeletedFalseAndInstallTaskIdIn(taskIds).forEach(b -> bundles.put(b.getId(), b));
            }
            Set<Long> orderTaskIds = new HashSet<>();
            bundles.values().forEach(b -> {
                if (b.getTaskId() != null) orderTaskIds.add(b.getTaskId());
                if (b.getInstallTaskId() != null) orderTaskIds.add(b.getInstallTaskId());
            });

            Set<Long> leadIds = new HashSet<>();
            for (TaskAssignment a : mine) if (a.getTask() != null && a.getTask().getLeadId() != null) leadIds.add(a.getTask().getLeadId());
            Map<Long, Lead> leads = new HashMap<>();
            leadRepository.findAllById(leadIds).forEach(l -> leads.put(l.getId(), l));

            for (TaskAssignment a : mine) {
                Task t = a.getTask();
                if (t == null || DEAD.contains(a.getStatus()) || Boolean.TRUE.equals(t.getIsDeleted())) continue;
                if (orderTaskIds.contains(t.getId()) || "BUNDLE".equals(t.getSource())) continue; // shown under Orders
                String group; String source; String link;
                if (t.getLeadId() != null) {
                    group = "leads";
                    Lead l = leads.get(t.getLeadId());
                    source = l == null ? "Lead #" + t.getLeadId() : l.getName() + (l.getLeadNumber() != null ? " · " + l.getLeadNumber() : "");
                    link = "/leads/" + t.getLeadId();
                } else if (t.getProject() != null) {
                    group = "projects";
                    source = t.getProject().getProjectName();
                    link = "/projects/" + t.getProject().getId();
                } else {
                    continue; // not tied to a lead, project or order
                }
                boolean isDone = "COMPLETED".equals(a.getStatus());
                LocalDateTime doneAt = a.getCompletedAt() != null ? a.getCompletedAt()
                        : (t.getCompletedDate() != null ? t.getCompletedDate().atStartOfDay() : null);
                Map<String, Object> row = row("T" + t.getId(), t.getTaskName(), source, link,
                        isDone ? "COMPLETED" : a.getStatus(), a.getAssignedDate(), t.getDueDate(), isDone ? doneAt : null,
                        t.getActualHours(), !isDone && t.getDueDate() != null && t.getDueDate().isBefore(today));
                row.put("stage", t.getStage());
                row.put("progress", t.getProgress());
                (isDone ? done : assigned).get(group).add(row);
            }

            Map<Long, Customer> customers = new HashMap<>();
            Set<Long> custIds = new HashSet<>();
            bundles.values().forEach(b -> { if (b.getCustomerId() != null) custIds.add(b.getCustomerId()); });
            customerRepository.findAllById(custIds).forEach(c -> customers.put(c.getId(), c));

            for (Bundle b : bundles.values()) {
                if ("CANCELLED".equals(b.getStatus())) continue;
                boolean isDone = "COMPLETED".equals(b.getStatus()) || "DELIVERED".equals(b.getStatus());
                LocalDateTime doneAt = b.getPackedAt() != null ? b.getPackedAt()
                        : b.getDeliveredAt() != null ? b.getDeliveredAt() : b.getUpdatedAt();
                Customer c = customers.get(b.getCustomerId());
                Map<String, Object> row = row("B" + b.getId(), b.getWorkType() + " · " + b.getCode(),
                        c != null ? c.getName() : null, "/bundles/" + b.getId(), b.getStatus(),
                        b.getCreatedAt(), b.getDueDate(), isDone ? doneAt : null, null,
                        !isDone && b.getDueDate() != null && b.getDueDate().isBefore(today));
                (isDone ? done : assigned).get("orders").add(row);
            }
        }

        // The window applies to finished work only.
        done.replaceAll((g, rows) -> {
            List<Map<String, Object>> kept = new ArrayList<>();
            for (Map<String, Object> r : rows) {
                LocalDateTime at = (LocalDateTime) r.get("completedAt");
                LocalDate d = at == null ? null : at.toLocalDate();
                if (d == null ? (from != null || to != null)
                        : ((from != null && d.isBefore(from)) || (to != null && d.isAfter(to)))) continue;
                kept.add(r);
            }
            kept.sort((x, y) -> String.valueOf(y.get("completedAt")).compareTo(String.valueOf(x.get("completedAt"))));
            return kept;
        });
        assigned.values().forEach(rows -> rows.sort(Comparator.comparing(
                (Map<String, Object> r) -> String.valueOf(r.get("dueDate")))));

        Map<String, Object> out = new LinkedHashMap<>();
        for (String g : List.of("leads", "projects", "orders")) {
            Map<String, Object> grp = new LinkedHashMap<>();
            grp.put("assigned", assigned.get(g));
            grp.put("done", done.get(g));
            out.put(g, grp);
        }
        int open = 0, overdue = 0, doneCount = 0; double hours = 0;
        for (List<Map<String, Object>> rows : assigned.values())
            for (Map<String, Object> r : rows) { open++; if (Boolean.TRUE.equals(r.get("overdue"))) overdue++; }
        for (List<Map<String, Object>> rows : done.values())
            for (Map<String, Object> r : rows) { doneCount++; if (r.get("hours") instanceof Number n) hours += n.doubleValue(); }
        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("assigned", open);
        totals.put("overdue", overdue);
        totals.put("done", doneCount);
        totals.put("hours", hours);
        out.put("totals", totals);
        return out;
    }

    private static Map<String, List<Map<String, Object>>> emptyGroups() {
        Map<String, List<Map<String, Object>>> m = new LinkedHashMap<>();
        for (String g : List.of("leads", "projects", "orders")) m.put(g, new ArrayList<>());
        return m;
    }

    private static Map<String, Object> row(String key, String name, String source, String link, String status,
                                           LocalDateTime assignedAt, LocalDate due, LocalDateTime completedAt,
                                           Double hours, boolean overdue) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("key", key);
        r.put("name", name);
        r.put("source", source);
        r.put("link", link);
        r.put("status", status);
        r.put("assignedAt", assignedAt);
        r.put("dueDate", due);
        r.put("completedAt", completedAt);
        r.put("hours", hours);
        r.put("overdue", overdue);
        return r;
    }
}

package com.arudra.crm.service;

import com.arudra.crm.dto.workforce.WorkforceResourceView;
import com.arudra.crm.entity.Contractor;
import com.arudra.crm.entity.ResourceType;
import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.TaskAssignment;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.ContractorRepository;
import com.arudra.crm.repository.TaskAssignmentRepository;
import com.arudra.crm.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The single place the Project module turns a ({@code resourceType}, {@code resourceId}) pair into
 * a concrete, displayable workforce resource — regardless of whether it lives in the employee
 * (users) or contractor (contractors) master. Adding a future resource type means adding one
 * branch in {@link #resolve} and {@link #list}; no schema change is required.
 */
@Service
public class WorkforceResourceService {

    @Autowired private UserRepository userRepository;
    @Autowired private ContractorRepository contractorRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;

    /** Resolve a single resource to its common view, or null if the id no longer exists. */
    public WorkforceResourceView resolve(String resourceType, Long resourceId) {
        if (resourceType == null || resourceId == null) return null;
        switch (ResourceType.normalize(resourceType)) {
            case ResourceType.EMPLOYEE:
                return userRepository.findById(resourceId).map(WorkforceResourceView::ofEmployee).orElse(null);
            case ResourceType.CONTRACTOR:
                return contractorRepository.findById(resourceId).map(WorkforceResourceView::ofContractor).orElse(null);
            default:
                return null; // future types plug in here
        }
    }

    /** True only when the pair points at an existing, assignable resource. Used to validate on assign. */
    public boolean exists(String resourceType, Long resourceId) {
        return resolve(resourceType, resourceId) != null;
    }

    /** Convenience for display: name of a resource, or a stable fallback if it was deleted. */
    public String displayName(String resourceType, Long resourceId) {
        WorkforceResourceView v = resolve(resourceType, resourceId);
        return v != null ? v.getName() : (resourceType != null ? resourceType + " #" + resourceId : null);
    }

    /**
     * Merged, filterable list of assignable resources for the unified picker.
     * @param search    optional case-insensitive name/contact filter
     * @param typeFilter optional single {@link ResourceType} to restrict to (null = all assignable)
     */
    public List<WorkforceResourceView> list(String search, String typeFilter) {
        String q = search == null ? "" : search.trim().toLowerCase();
        String type = typeFilter == null || typeFilter.isBlank() ? null : ResourceType.normalize(typeFilter);
        List<WorkforceResourceView> out = new ArrayList<>();

        if (type == null || ResourceType.EMPLOYEE.equals(type)) {
            for (User u : userRepository.findAll()) {
                WorkforceResourceView v = WorkforceResourceView.ofEmployee(u);
                if (matches(v, q)) out.add(v);
            }
        }
        if (type == null || ResourceType.CONTRACTOR.equals(type)) {
            for (Contractor c : contractorRepository.findByStatusOrderByNameAsc("ACTIVE")) {
                WorkforceResourceView v = WorkforceResourceView.ofContractor(c);
                if (matches(v, q)) out.add(v);
            }
        }
        return out;
    }

    private boolean matches(WorkforceResourceView v, String q) {
        if (q.isEmpty()) return true;
        return (v.getName() != null && v.getName().toLowerCase().contains(q))
                || (v.getContact() != null && v.getContact().toLowerCase().contains(q))
                || (v.getSubtitle() != null && v.getSubtitle().toLowerCase().contains(q));
    }

    /**
     * Unified workforce dashboard — assigned / completed / overdue / productivity across BOTH
     * employees and contractors, derived from {@link TaskAssignment} rows so it is resource-agnostic.
     */
    public Map<String, Object> dashboard() {
        LocalDate today = LocalDate.now();
        List<TaskAssignment> assignments = assignmentRepository.findAll().stream()
                .filter(a -> a.getResourceType() != null && a.getResourceId() != null)
                .filter(a -> !"CANCELLED".equalsIgnoreCase(a.getStatus()) && !"REJECTED".equalsIgnoreCase(a.getStatus()))
                .toList();

        long total = assignments.size();
        long completed = assignments.stream().filter(a -> "COMPLETED".equalsIgnoreCase(a.getStatus())).count();
        long inProgress = assignments.stream().filter(a -> "IN_PROGRESS".equalsIgnoreCase(a.getStatus())).count();
        long overdue = assignments.stream().filter(a -> isOverdue(a, today)).count();
        long employeeAssignments = assignments.stream().filter(a -> ResourceType.EMPLOYEE.equalsIgnoreCase(a.getResourceType())).count();
        long contractorAssignments = assignments.stream().filter(a -> ResourceType.CONTRACTOR.equalsIgnoreCase(a.getResourceType())).count();

        // Per-resource productivity.
        Map<String, long[]> byResource = new LinkedHashMap<>(); // key -> [assigned, completed, overdue]
        Map<String, String> keyType = new LinkedHashMap<>();
        Map<String, Long> keyId = new LinkedHashMap<>();
        for (TaskAssignment a : assignments) {
            String key = a.getResourceType() + ":" + a.getResourceId();
            long[] agg = byResource.computeIfAbsent(key, k -> new long[3]);
            agg[0]++;
            if ("COMPLETED".equalsIgnoreCase(a.getStatus())) agg[1]++;
            if (isOverdue(a, today)) agg[2]++;
            keyType.put(key, a.getResourceType());
            keyId.put(key, a.getResourceId());
        }
        List<Map<String, Object>> productivity = new ArrayList<>();
        for (Map.Entry<String, long[]> e : byResource.entrySet()) {
            long[] agg = e.getValue();
            String type = keyType.get(e.getKey());
            Long rid = keyId.get(e.getKey());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("resourceType", type);
            row.put("resourceId", rid);
            row.put("name", displayName(type, rid));
            row.put("assigned", agg[0]);
            row.put("completed", agg[1]);
            row.put("overdue", agg[2]);
            row.put("completionRate", agg[0] == 0 ? 0 : Math.round(agg[1] * 100.0 / agg[0]));
            productivity.add(row);
        }
        productivity.sort((a, b) -> Long.compare(
                ((Number) b.get("completed")).longValue(), ((Number) a.get("completed")).longValue()));

        Map<String, Object> d = new LinkedHashMap<>();
        d.put("totalAssignments", total);
        d.put("completedAssignments", completed);
        d.put("inProgressAssignments", inProgress);
        d.put("overdueAssignments", overdue);
        d.put("employeeAssignments", employeeAssignments);
        d.put("contractorAssignments", contractorAssignments);
        d.put("distinctResources", byResource.size());
        d.put("productivity", productivity);
        return d;
    }

    private boolean isOverdue(TaskAssignment a, LocalDate today) {
        Task t = a.getTask();
        return t != null && t.getDueDate() != null && t.getDueDate().isBefore(today)
                && !"COMPLETED".equalsIgnoreCase(a.getStatus());
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.Lead;
import com.arudra.crm.entity.LeadAssignment;
import com.arudra.crm.entity.Project;
import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.TaskAssignment;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.LeadAssignmentRepository;
import com.arudra.crm.repository.TaskAssignmentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Compact "team" chips for the Leads / Projects / Task lists. Read-only and bulk: one query per page,
 * never per row. Each entry is {userId, name, role}; named roles come first, task members after.
 */
@Service
public class TeamSummaryService {

    public static final String MEMBER = "Member";

    @Autowired private TaskAssignmentRepository taskAssignmentRepository;
    @Autowired private LeadAssignmentRepository leadAssignmentRepository;

    private static boolean live(TaskAssignment a) {
        if (a.getEmployee() == null || a.getTask() == null) return false;
        if ("CANCELLED".equals(a.getStatus()) || "REJECTED".equals(a.getStatus())) return false;
        Task t = a.getTask();
        return !Boolean.TRUE.equals(t.getIsDeleted()) && !"CANCELLED".equals(t.getStatus());
    }

    /** First role wins for a person, so the manager label isn't downgraded to "Member". */
    private static void add(Map<Long, Map<String, Object>> team, User u, String role) {
        if (u == null || u.getId() == null) return;
        team.computeIfAbsent(u.getId(), id -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", u.getId());
            m.put("name", u.getName());
            m.put("role", role);
            return m;
        });
    }

    @Transactional(readOnly = true)
    public void attachToProjects(Collection<Project> projects) {
        if (projects == null || projects.isEmpty()) return;
        Set<Long> ids = projects.stream().map(Project::getId).collect(Collectors.toSet());
        Map<Long, List<TaskAssignment>> byProject = new HashMap<>();
        for (TaskAssignment a : taskAssignmentRepository.findWithEmployeeByProjectIds(ids)) {
            if (!live(a) || a.getTask().getProject() == null) continue;
            byProject.computeIfAbsent(a.getTask().getProject().getId(), k -> new ArrayList<>()).add(a);
        }
        for (Project p : projects) {
            Map<Long, Map<String, Object>> team = new LinkedHashMap<>();
            add(team, p.getProjectManager(), "Project Manager");
            add(team, p.getAssistantManager(), "Assistant Manager");
            for (TaskAssignment a : byProject.getOrDefault(p.getId(), List.of())) add(team, a.getEmployee(), MEMBER);
            p.setTeam(new ArrayList<>(team.values()));
        }
    }

    @Transactional(readOnly = true)
    public void attachToLeads(Collection<Lead> leads) {
        if (leads == null || leads.isEmpty()) return;
        Set<Long> ids = leads.stream().map(Lead::getId).collect(Collectors.toSet());
        Map<Long, List<LeadAssignment>> assigns = new HashMap<>();
        for (LeadAssignment a : leadAssignmentRepository.findWithUserByLeadIds(ids)) {
            if (a.getLead() == null) continue;
            assigns.computeIfAbsent(a.getLead().getId(), k -> new ArrayList<>()).add(a);
        }
        Map<Long, List<TaskAssignment>> byLead = new HashMap<>();
        for (TaskAssignment a : taskAssignmentRepository.findWithEmployeeByLeadIds(ids)) {
            if (!live(a) || a.getTask().getLeadId() == null) continue;
            byLead.computeIfAbsent(a.getTask().getLeadId(), k -> new ArrayList<>()).add(a);
        }
        for (Lead l : leads) {
            Map<Long, Map<String, Object>> team = new LinkedHashMap<>();
            add(team, l.getAssignedSalesExecutive(), "Sales Executive");
            add(team, l.getAssignedDesigner(), "Designer");
            add(team, l.getAssignedEngineer(), "Engineer");
            for (LeadAssignment a : assigns.getOrDefault(l.getId(), List.of())) {
                add(team, a.getAssignedTo(), a.getAssignedRole() != null ? a.getAssignedRole() : MEMBER);
            }
            for (TaskAssignment a : byLead.getOrDefault(l.getId(), List.of())) add(team, a.getEmployee(), MEMBER);
            l.setTeam(new ArrayList<>(team.values()));
        }
    }

    /** Live assignees per task id: {userId, name, role} — role is the assignment role (or Member). */
    @Transactional(readOnly = true)
    public Map<Long, List<Map<String, Object>>> forTasks(Collection<Long> taskIds) {
        Map<Long, List<Map<String, Object>>> out = new HashMap<>();
        if (taskIds == null || taskIds.isEmpty()) return out;
        Map<Long, Map<Long, Map<String, Object>>> byTask = new LinkedHashMap<>();
        for (TaskAssignment a : taskAssignmentRepository.findWithEmployeeByTaskIds(taskIds)) {
            if (!live(a)) continue;
            add(byTask.computeIfAbsent(a.getTask().getId(), k -> new LinkedHashMap<>()), a.getEmployee(), MEMBER);
        }
        byTask.forEach((k, v) -> out.put(k, new ArrayList<>(v.values())));
        return out;
    }
}

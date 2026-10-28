package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

/**
 * One list of everyone working a project: the Project Manager / Assistant Manager the admin set AND anyone
 * who holds a task on it (assigned by the office, auto-assigned or picked up themselves). The admin edits
 * that single list — change a role, add a person, or remove one from the project.
 */
@Service
public class ProjectPeopleService {

    public static final String PM = "PROJECT_MANAGER";
    public static final String AM = "ASSISTANT_MANAGER";
    public static final String MEMBER = "MEMBER";

    @Autowired private ProjectRepository projectRepository;
    @Autowired private TaskRepository taskRepository;
    @Autowired private TaskAssignmentRepository assignmentRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ProjectService projectService;
    @Autowired private EmployeeTaskService employeeTaskService;

    private static boolean closed(Task t) {
        return "COMPLETED".equals(t.getStatus()) || "CANCELLED".equals(t.getStatus());
    }

    private static boolean active(TaskAssignment a) {
        return !"CANCELLED".equals(a.getStatus()) && !"REJECTED".equals(a.getStatus());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> people(Long projectId) {
        Project p = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        Map<Long, Map<String, Object>> byUser = new LinkedHashMap<>();
        if (p.getProjectManager() != null) entry(byUser, p.getProjectManager()).put("role", PM);
        if (p.getAssistantManager() != null) entry(byUser, p.getAssistantManager()).put("role", AM);
        for (Task t : taskRepository.findByProjectId(projectId)) {
            if (Boolean.TRUE.equals(t.getIsDeleted()) || "CANCELLED".equals(t.getStatus())) continue;
            for (TaskAssignment a : assignmentRepository.findByTaskId(t.getId())) {
                if (!active(a) || a.getEmployee() == null) continue;
                Map<String, Object> e = entry(byUser, a.getEmployee());
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> tasks = (List<Map<String, Object>>) e.get("tasks");
                Map<String, Object> tm = new LinkedHashMap<>();
                tm.put("id", t.getId());
                tm.put("name", t.getTaskName());
                tm.put("status", t.getStatus());
                tasks.add(tm);
                // Picked up by the person themself (vs. given by the office / auto-assign).
                if (a.getAssignedBy() != null && a.getAssignedBy().getId().equals(a.getEmployee().getId())) {
                    e.put("pickedOwn", true);
                }
            }
        }
        return new ArrayList<>(byUser.values());
    }

    private Map<String, Object> entry(Map<Long, Map<String, Object>> byUser, User u) {
        return byUser.computeIfAbsent(u.getId(), id -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", u.getId());
            m.put("name", u.getName());
            m.put("role", MEMBER);
            m.put("pickedOwn", false);
            m.put("tasks", new ArrayList<Map<String, Object>>());
            return m;
        });
    }

    /** Add a person to the project, or change their role (PROJECT_MANAGER / ASSISTANT_MANAGER / MEMBER). */
    @Transactional
    public void setRole(Long projectId, Long userId, String role, User by) {
        Project p = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        userRepository.findById(userId).orElseThrow(() -> new RuntimeException("Employee not found"));
        String r = role == null ? MEMBER : role.toUpperCase();
        Long pm = p.getProjectManager() == null ? null : p.getProjectManager().getId();
        Long am = p.getAssistantManager() == null ? null : p.getAssistantManager().getId();
        if (userId.equals(pm)) pm = null;
        if (userId.equals(am)) am = null;
        if (PM.equals(r)) pm = userId;
        else if (AM.equals(r)) am = userId;
        projectService.assignTeam(projectId, pm, am);
        if (MEMBER.equals(r)) employeeTaskService.addProjectMember(projectId, userId, by);
    }

    /** Take a person off the project: clears their manager role and unassigns their open tasks. */
    @Transactional
    public int remove(Long projectId, Long userId) {
        Project p = projectRepository.findById(projectId).orElseThrow(() -> new RuntimeException("Project not found"));
        Long pm = p.getProjectManager() == null ? null : p.getProjectManager().getId();
        Long am = p.getAssistantManager() == null ? null : p.getAssistantManager().getId();
        if (userId.equals(pm) || userId.equals(am)) {
            projectService.assignTeam(projectId, userId.equals(pm) ? null : pm, userId.equals(am) ? null : am);
        }
        int removed = 0;
        for (Task t : taskRepository.findByProjectId(projectId)) {
            if (Boolean.TRUE.equals(t.getIsDeleted()) || closed(t)) continue;
            boolean on = assignmentRepository.findByTaskId(t.getId()).stream()
                    .anyMatch(a -> active(a) && a.getEmployee() != null && userId.equals(a.getEmployee().getId()));
            if (!on) continue;
            employeeTaskService.removeResourceAssignment(t.getId(), ResourceType.EMPLOYEE, userId);
            removed++;
        }
        return removed;
    }
}

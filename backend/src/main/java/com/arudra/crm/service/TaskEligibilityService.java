package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.Role;
import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.User;
import com.arudra.crm.entity.Workforce;
import com.arudra.crm.repository.EmployeeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Decides whether an employee is allowed to pick/join a task, by matching the task's eligible
 * roles/skills (copied from its {@link com.arudra.crm.entity.TaskTemplate}) against the employee's
 * capability tokens — their security roles plus HR designation, department and workforce skills.
 *
 * <p>Deliberately lenient (any-match, substring-tolerant) because this is a small company where one
 * person wears several hats; a task with no eligible roles is open to everyone, preserving the
 * pre-workflow behaviour of manual/project tasks. Admins bypass the gate entirely.
 */
@Service
public class TaskEligibilityService {

    @Autowired
    private EmployeeRepository employeeRepository;

    /** True when the employee may pick/join this task. */
    public boolean isEligible(User user, Task task) {
        if (user == null) return false;
        if (isAdmin(user)) return true;

        Set<String> required = new LinkedHashSet<>();
        required.addAll(tokens(task.getEligibleRoles()));
        required.addAll(tokens(task.getEligibleSkills()));
        if (required.isEmpty()) return true; // open task

        Set<String> have = capabilityTokens(user);
        for (String r : required) {
            for (String c : have) {
                if (tokensMatch(c, r)) return true;
            }
        }
        return false;
    }

    /**
     * Lenient token match for the small-company gate: exact, substring either way, or a shared
     * word-stem. The stem check (6+ leading chars in common) bridges word-forms the substring test
     * misses — e.g. "estimator" (a role) vs "estimation" (a task requirement), "designer" vs
     * "design". Six chars keeps it from colliding unrelated short tokens.
     */
    private boolean tokensMatch(String a, String b) {
        if (a.equals(b) || a.contains(b) || b.contains(a)) return true;
        return a.length() >= 6 && b.length() >= 6 && a.substring(0, 6).equals(b.substring(0, 6));
    }

    /** Human-readable reason an employee can't take a task (null when they can). */
    public String ineligibleReason(User user, Task task) {
        if (isEligible(user, task)) return null;
        String needed = task.getEligibleRoles();
        if (needed == null || needed.isBlank()) needed = task.getEligibleSkills();
        return "This task needs " + (needed == null ? "a different capability" : needed)
                + " — it isn't available to your role.";
    }

    /** The lowercased capability tokens for a user: security roles + HR designation/department/skills. */
    public Set<String> capabilityTokens(User user) {
        Set<String> tokens = new LinkedHashSet<>();
        if (user.getRoles() != null) {
            for (Role role : user.getRoles()) {
                if (role.getName() == null) continue;
                String t = role.getName().replaceFirst("(?i)^ROLE_", "").replace('_', ' ').trim().toLowerCase();
                if (!t.isEmpty()) tokens.add(t);
            }
        }
        // Bridge to the HR master record by email (same convention as SmartAssignmentService).
        if (user.getEmail() != null) {
            employeeRepository.findByEmailIgnoreCaseAndIsDeletedFalse(user.getEmail()).ifPresent(emp -> {
                addToken(tokens, emp.getDesignation());
                if (emp.getDepartment() != null) addToken(tokens, emp.getDepartment().getName());
                Workforce wf = emp.getWorkforce();
                if (wf != null) {
                    addToken(tokens, wf.getPrimarySkill());
                    for (String s : tokens(wf.getSecondarySkills())) tokens.add(s);
                }
            });
        }
        return tokens;
    }

    private boolean isAdmin(User user) {
        return user.getRoles() != null && user.getRoles().stream()
                .anyMatch(r -> "ROLE_ADMIN".equalsIgnoreCase(r.getName()));
    }

    private void addToken(Set<String> set, String raw) {
        if (raw != null && !raw.isBlank()) set.add(raw.trim().toLowerCase());
    }

    private Set<String> tokens(String csv) {
        Set<String> out = new LinkedHashSet<>();
        if (csv == null || csv.isBlank()) return out;
        Arrays.stream(csv.split(",")).map(String::trim).filter(s -> !s.isEmpty())
                .forEach(s -> out.add(s.toLowerCase()));
        return out;
    }
}

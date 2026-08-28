package com.arudra.crm.service;

import com.arudra.crm.entity.Role;
import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.User;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Role-token matching for the task pool. Users here have no email, so the HR (employee) bridge is
 * skipped and matching relies purely on security roles — keeping the test free of Spring/DB.
 */
class TaskEligibilityServiceTest {

    private final TaskEligibilityService svc = new TaskEligibilityService();

    private User user(String... roleNames) {
        User u = new User();
        u.setEmail(null); // skip the employee-record bridge
        java.util.Set<Role> roles = new java.util.HashSet<>();
        for (String rn : roleNames) {
            Role r = new Role();
            r.setName(rn);
            roles.add(r);
        }
        u.setRoles(roles);
        return u;
    }

    private Task task(String eligibleRoles) {
        Task t = new Task();
        t.setEligibleRoles(eligibleRoles);
        return t;
    }

    @Test
    void admin_isEligibleForAnything() {
        assertTrue(svc.isEligible(user("ROLE_ADMIN"), task("Estimation")));
    }

    @Test
    void openTask_isEligibleForEveryone() {
        assertTrue(svc.isEligible(user("ROLE_EMPLOYEE"), task(null)));
        assertTrue(svc.isEligible(user(), task("")));
    }

    @Test
    void matchingRole_isEligible() {
        assertTrue(svc.isEligible(user("ROLE_SALES"), task("Sales")));
        assertTrue(svc.isEligible(user("ROLE_SALES"), task("Sales,Site"))); // any-of
    }

    @Test
    void nonMatchingRole_isNotEligible() {
        User u = user("ROLE_SALES");
        assertFalse(svc.isEligible(u, task("Estimation")));
    }

    @Test
    void roleUnderscoresNormalizeToSpaces() {
        // ROLE_PROJECT_MANAGER → "project manager"; task requiring "Project" matches by substring.
        assertTrue(svc.isEligible(user("ROLE_PROJECT_MANAGER"), task("Project")));
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.Role;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.EmployeeRepository;
import com.arudra.crm.repository.RoleRepository;
import com.arudra.crm.repository.UserRepository;
import com.arudra.crm.security.PasswordPolicy;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Owns the explicit employee ↔ login link (employees.user_id). A username/password can only be
 * changed for an employee whose login is linked, and the employee's own e-mail always moves with
 * the username so the two can never drift apart.
 */
@Service
public class EmployeeLoginService {

    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;

    public EmployeeLoginService(EmployeeRepository employeeRepository, UserRepository userRepository,
                                RoleRepository roleRepository, PasswordEncoder passwordEncoder,
                                RefreshTokenService refreshTokenService, EmailService emailService) {
        this.employeeRepository = employeeRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokenService = refreshTokenService;
        this.emailService = emailService;
    }

    // --- read ---

    public Map<String, Object> status(Long employeeId) {
        Employee emp = employee(employeeId);
        Map<String, Object> out = new HashMap<>();
        User user = emp.getUserId() == null ? null : userRepository.findById(emp.getUserId()).orElse(null);
        out.put("linked", user != null);
        if (user != null) {
            Map<String, Object> u = new HashMap<>();
            u.put("id", user.getId());
            u.put("name", user.getName());
            u.put("email", user.getEmail());
            u.put("locked", !user.isAccountNonLocked());
            u.put("disabled", !user.isEmailVerified());
            u.put("mustChangePassword", user.isMustChangePassword());
            u.put("roles", user.getRoles().stream().map(Role::getName).sorted().collect(Collectors.toList()));
            out.put("user", u);
            out.put("emailMismatch", emp.getEmail() != null && !emp.getEmail().equalsIgnoreCase(user.getEmail()));
        }
        return out;
    }

    /** Logins that belong to no employee — what an admin can pick to link. */
    public List<Map<String, Object>> linkCandidates() {
        java.util.Set<Long> taken = employeeRepository.findByUserIdIsNotNull().stream()
                .map(Employee::getUserId).collect(Collectors.toSet());
        return userRepository.findAll().stream()
                .filter(u -> !taken.contains(u.getId()))
                .sorted((a, b) -> String.valueOf(a.getName()).compareToIgnoreCase(String.valueOf(b.getName())))
                .map(u -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("id", u.getId());
                    m.put("name", u.getName());
                    m.put("email", u.getEmail());
                    return m;
                }).collect(Collectors.toList());
    }

    // --- link / unlink ---

    @Transactional
    public Map<String, Object> link(Long employeeId, Long userId) {
        Employee emp = employee(employeeId);
        if (emp.getUserId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This employee already has a linked login. Unlink it first.");
        }
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a login to link.");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        employeeRepository.findByUserId(userId).ifPresent(other -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "That login is already linked to " + other.getFirstName() + " " + other.getLastName() + ".");
        });
        // The username and the employee e-mail must be one and the same; the chosen login wins.
        if (!user.getEmail().equalsIgnoreCase(emp.getEmail())) {
            requireEmployeeEmailFree(emp, user.getEmail());
            emp.setEmail(user.getEmail());
        }
        emp.setUserId(user.getId());
        employeeRepository.save(emp);
        ensureEmployeeRole(user);
        return status(employeeId);
    }

    @Transactional
    public Map<String, Object> unlink(Long employeeId) {
        Employee emp = employee(employeeId);
        if (emp.getUserId() != null) {
            userRepository.findById(emp.getUserId()).ifPresent(refreshTokenService::revokeAll);
            emp.setUserId(null);
            employeeRepository.save(emp);
        }
        return status(employeeId);
    }

    /** Creates a login from the employee's e-mail (temp password e-mailed) and links it. */
    @Transactional
    public Map<String, Object> createAndLink(Long employeeId) {
        Employee emp = employee(employeeId);
        if (emp.getUserId() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This employee already has a linked login.");
        }
        if (emp.getEmail() == null || emp.getEmail().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Add an e-mail to the employee first.");
        }
        if (userRepository.findByEmail(emp.getEmail().trim()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "A login with this e-mail already exists — use \"Link existing login\" instead.");
        }
        String temp = PasswordPolicy.generateTemporary();
        User user = new User();
        user.setName(emp.getFirstName() + " " + emp.getLastName());
        user.setEmail(emp.getEmail().trim());
        user.setPassword(passwordEncoder.encode(temp));
        user.setEmailVerified(true);
        user.setMustChangePassword(true);
        user.setRoles(new HashSet<>());
        roleRepository.findByName("ROLE_EMPLOYEE").ifPresent(r -> user.getRoles().add(r));
        userRepository.save(user);
        emp.setUserId(user.getId());
        employeeRepository.save(emp);
        emailService.send(user.getEmail(), "Your sign-in details",
                "Hi " + user.getName() + ",\n\nAn account has been created for you. Sign in with this e-mail address and the "
                + "temporary password below. You will be asked to choose your own password straight away.\n\n"
                + "Temporary password: " + temp);
        return status(employeeId);
    }

    // --- change username / password ---

    @Transactional
    public Map<String, Object> updateLogin(Long employeeId, String newEmail, String newPassword) {
        Employee emp = employee(employeeId);
        User user = emp.getUserId() == null ? null : userRepository.findById(emp.getUserId()).orElse(null);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Link a login to this employee before changing the username or password.");
        }
        boolean changed = false;
        if (newEmail != null && !newEmail.isBlank()) {
            changed |= rename(emp, user, newEmail);
        }
        if (newPassword != null && !newPassword.isBlank()) {
            String problem = PasswordPolicy.validate(newPassword, user.getEmail());
            if (problem != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, problem);
            user.setPassword(passwordEncoder.encode(newPassword));
            user.setMustChangePassword(true); // admin knows it — the employee picks their own on next sign-in
            user.setFailedAttempts(0);
            user.setAccountNonLocked(true);
            user.setLockTime(null);
            changed = true;
        }
        if (!changed) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Nothing to change.");
        }
        userRepository.save(user);
        refreshTokenService.revokeAll(user); // old sessions carry the old username/password
        return status(employeeId);
    }

    /** Called when HR edits the employee's e-mail: a linked login's username moves with it. */
    @Transactional
    public void onEmployeeEmailChanged(Employee emp, String newEmail) {
        User user = emp.getUserId() == null ? null : userRepository.findById(emp.getUserId()).orElse(null);
        if (user == null) {
            requireEmployeeEmailFree(emp, newEmail);
            emp.setEmail(newEmail.trim());
            return;
        }
        if (rename(emp, user, newEmail)) {
            userRepository.save(user);
            refreshTokenService.revokeAll(user);
        }
    }

    private boolean rename(Employee emp, User user, String rawEmail) {
        String email = rawEmail.trim().toLowerCase();
        if (email.equalsIgnoreCase(user.getEmail()) && email.equalsIgnoreCase(emp.getEmail())) return false;
        userRepository.findByEmail(email).ifPresent(other -> {
            if (!other.getId().equals(user.getId()))
                throw new ResponseStatusException(HttpStatus.CONFLICT, "That username is already used by another login.");
        });
        requireEmployeeEmailFree(emp, email);
        user.setEmail(email);
        emp.setEmail(email);
        employeeRepository.save(emp);
        return true;
    }

    private void requireEmployeeEmailFree(Employee emp, String email) {
        boolean taken = employeeRepository.findAll().stream()
                .anyMatch(e -> !e.getId().equals(emp.getId()) && email.trim().equalsIgnoreCase(e.getEmail()));
        if (taken) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Another employee already uses the e-mail " + email.trim() + ".");
        }
    }

    private void ensureEmployeeRole(User user) {
        java.util.Set<Role> roles = user.getRoles() != null ? new HashSet<>(user.getRoles()) : new HashSet<>();
        roleRepository.findByName("ROLE_EMPLOYEE").ifPresent(roles::add);
        user.setRoles(roles);
        userRepository.save(user);
    }

    private Employee employee(Long id) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found."));
    }
}

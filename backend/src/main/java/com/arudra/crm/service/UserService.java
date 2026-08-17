package com.arudra.crm.service;

import com.arudra.crm.dto.user.CreateUserRequest;
import com.arudra.crm.dto.user.UpdateUserRequest;
import com.arudra.crm.dto.user.UserAdminDTO;
import com.arudra.crm.entity.Role;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.RoleRepository;
import com.arudra.crm.repository.UserRepository;
import com.arudra.crm.security.CurrentUserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Admin-facing user administration: list logins, create/edit accounts, assign roles,
 * force-reset passwords and unlock accounts. All callers are already gated to ROLE_ADMIN
 * at the controller; this service adds the integrity guards (unique email, keep-an-admin,
 * don't-delete-yourself).
 */
@Service
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUserService currentUserService;

    public UserService(UserRepository userRepository, RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder, CurrentUserService currentUserService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.currentUserService = currentUserService;
    }

    public List<UserAdminDTO> listUsers() {
        return userRepository.findAll().stream()
                .map(UserAdminDTO::from)
                .sorted((a, b) -> a.getName() == null ? 1 : a.getName().compareToIgnoreCase(b.getName() == null ? "" : b.getName()))
                .collect(Collectors.toList());
    }

    @Transactional
    public UserAdminDTO createUser(CreateUserRequest req) {
        String email = normalizeEmail(req.getEmail());
        if (email.isEmpty() || req.getName() == null || req.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name and email are required.");
        }
        if (req.getPassword() == null || req.getPassword().length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters.");
        }
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with that email already exists.");
        }

        User user = new User();
        user.setName(req.getName().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(req.getPassword()));
        user.setEmailVerified(req.getEmailVerified() != null ? req.getEmailVerified() : true);
        user.setRoles(resolveRoles(req.getRoles()));
        return UserAdminDTO.from(userRepository.save(user));
    }

    @Transactional
    public UserAdminDTO updateUser(Long id, UpdateUserRequest req) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));

        if (req.getName() != null && !req.getName().isBlank()) {
            user.setName(req.getName().trim());
        }
        if (req.getEmail() != null && !req.getEmail().isBlank()) {
            String email = normalizeEmail(req.getEmail());
            userRepository.findByEmail(email).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "A user with that email already exists.");
                }
            });
            user.setEmail(email);
        }
        if (req.getRoles() != null) {
            // Don't let the last admin lose their admin role and lock everyone out.
            if (isRemovingLastAdmin(user, req.getRoles())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot remove admin role from the last remaining administrator.");
            }
            user.setRoles(resolveRoles(req.getRoles()));
        }
        return UserAdminDTO.from(userRepository.save(user));
    }

    @Transactional
    public void adminResetPassword(Long id, String newPassword) {
        if (newPassword == null || newPassword.length() < 6) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters.");
        }
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        user.setPassword(passwordEncoder.encode(newPassword));
        // Clear any lockout so the user can log straight in with the new password.
        user.setFailedAttempts(0);
        user.setAccountNonLocked(true);
        user.setLockTime(null);
        userRepository.save(user);
    }

    @Transactional
    public UserAdminDTO unlockUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        user.setFailedAttempts(0);
        user.setAccountNonLocked(true);
        user.setLockTime(null);
        return UserAdminDTO.from(userRepository.save(user));
    }

    @Transactional
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found."));
        User current = currentUserService.getCurrentUser();
        if (current != null && current.getId().equals(id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You cannot delete your own account.");
        }
        if (hasRole(user, "ROLE_ADMIN") && countAdmins() <= 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete the last remaining administrator.");
        }
        userRepository.delete(user);
    }

    // --- helpers ---

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private Set<Role> resolveRoles(List<String> roleNames) {
        Set<Role> roles = new HashSet<>();
        if (roleNames == null) {
            return roles;
        }
        for (String name : roleNames) {
            if (name == null || name.isBlank()) continue;
            Role role = roleRepository.findByName(name.trim())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown role: " + name));
            roles.add(role);
        }
        return roles;
    }

    private boolean hasRole(User user, String roleName) {
        return user.getRoles().stream().anyMatch(r -> roleName.equals(r.getName()));
    }

    private long countAdmins() {
        return userRepository.findByRoleNames(List.of("ROLE_ADMIN")).size();
    }

    /** True if this edit would strip ROLE_ADMIN from the only admin left. */
    private boolean isRemovingLastAdmin(User user, List<String> newRoleNames) {
        boolean wasAdmin = hasRole(user, "ROLE_ADMIN");
        boolean willBeAdmin = newRoleNames.stream().anyMatch("ROLE_ADMIN"::equals);
        return wasAdmin && !willBeAdmin && countAdmins() <= 1;
    }
}

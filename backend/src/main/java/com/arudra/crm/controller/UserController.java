package com.arudra.crm.controller;

import com.arudra.crm.dto.user.AdminResetPasswordRequest;
import com.arudra.crm.dto.user.CreateUserRequest;
import com.arudra.crm.dto.user.UpdateUserRequest;
import com.arudra.crm.dto.user.UserAdminDTO;
import com.arudra.crm.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin user administration. Every endpoint is ROLE_ADMIN only — managing logins,
 * roles and passwords is a privileged operation regardless of a user's other permissions.
 */
@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ResponseEntity<List<UserAdminDTO>> getAllUsers() {
        return ResponseEntity.ok(userService.listUsers());
    }

    @PostMapping
    public ResponseEntity<UserAdminDTO> createUser(@RequestBody CreateUserRequest request) {
        return ResponseEntity.ok(userService.createUser(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UserAdminDTO> updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    /** Admin sets any user's password directly (no OTP needed). */
    @PostMapping("/{id}/reset-password")
    public ResponseEntity<?> resetPassword(@PathVariable Long id, @RequestBody AdminResetPasswordRequest request) {
        userService.adminResetPassword(id, request.getNewPassword());
        return ResponseEntity.ok(Map.of("success", true, "message", "Password updated."));
    }

    @PostMapping("/{id}/unlock")
    public ResponseEntity<UserAdminDTO> unlockUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.unlockUser(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "User deleted."));
    }
}

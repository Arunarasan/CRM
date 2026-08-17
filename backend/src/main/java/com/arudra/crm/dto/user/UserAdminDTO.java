package com.arudra.crm.dto.user;

import com.arudra.crm.entity.Role;
import com.arudra.crm.entity.User;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

/** Read model for the admin Users list — never carries the password hash. */
@Data
public class UserAdminDTO {
    private Long id;
    private String name;
    private String email;
    private boolean emailVerified;
    private boolean locked;
    private int failedAttempts;
    private List<String> roles;
    private LocalDateTime createdAt;

    public static UserAdminDTO from(User user) {
        UserAdminDTO dto = new UserAdminDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setEmailVerified(user.isEmailVerified());
        dto.setLocked(!user.isAccountNonLocked());
        dto.setFailedAttempts(user.getFailedAttempts());
        dto.setRoles(user.getRoles().stream().map(Role::getName).sorted().collect(Collectors.toList()));
        dto.setCreatedAt(user.getCreatedAt());
        return dto;
    }
}

package com.arudra.crm.dto.lead;

import com.arudra.crm.entity.Role;
import com.arudra.crm.entity.User;
import lombok.Data;

import java.util.List;
import java.util.stream.Collectors;

/** Minimal user representation for assignment pickers. */
@Data
public class UserSummaryDTO {
    private Long id;
    private String name;
    private String email;
    private List<String> roles;

    public static UserSummaryDTO from(User user) {
        UserSummaryDTO dto = new UserSummaryDTO();
        dto.setId(user.getId());
        dto.setName(user.getName());
        dto.setEmail(user.getEmail());
        dto.setRoles(user.getRoles().stream().map(Role::getName).collect(Collectors.toList()));
        return dto;
    }
}

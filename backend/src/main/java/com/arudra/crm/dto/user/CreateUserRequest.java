package com.arudra.crm.dto.user;

import lombok.Data;

import java.util.List;

/** Admin creates a new login. Roles are role names like ROLE_SALES. */
@Data
public class CreateUserRequest {
    private String name;
    private String email;
    private String password;
    private List<String> roles;
    private Boolean emailVerified;
}

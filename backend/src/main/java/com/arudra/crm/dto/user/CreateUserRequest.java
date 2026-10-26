package com.arudra.crm.dto.user;

import lombok.Data;

import java.util.List;

/** Admin creates a new login. Roles are role names ROLE_ADMIN or ROLE_EMPLOYEE. */
@Data
public class CreateUserRequest {
    private String name;
    private String email;
    private String phone;
    private String password;
    private List<String> roles;
    private Boolean emailVerified;
}

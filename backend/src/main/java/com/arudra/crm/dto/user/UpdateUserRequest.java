package com.arudra.crm.dto.user;

import lombok.Data;

import java.util.List;

/** Admin edits an existing user's profile / role set. Any null field is left unchanged. */
@Data
public class UpdateUserRequest {
    private String name;
    private String email;
    private List<String> roles;
}

package com.arudra.crm.dto;

import lombok.Data;

@Data
public class PasswordResetRequest {
    private String token;
    private String newPassword;
}

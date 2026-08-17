package com.arudra.crm.dto;

import lombok.Data;

/** Final step of the forgot-password flow: email + OTP + the new password to set. */
@Data
public class PasswordResetRequest {
    private String email;
    private String otp;
    private String newPassword;
}

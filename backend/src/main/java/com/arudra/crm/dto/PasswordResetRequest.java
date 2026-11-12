package com.arudra.crm.dto;

import lombok.Data;

/** Final step of the forgot-password flow: email + OTP + the new password to set. */
@Data
public class PasswordResetRequest {
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 254)
    private String email;
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 12)
    private String otp;
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 200)
    private String newPassword;
}

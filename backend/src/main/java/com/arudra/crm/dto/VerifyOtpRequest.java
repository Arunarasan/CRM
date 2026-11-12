package com.arudra.crm.dto;

import lombok.Data;

/** Optional middle step: check an OTP is valid before showing the new-password fields. */
@Data
public class VerifyOtpRequest {
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 254)
    private String email;
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 12)
    private String otp;
}

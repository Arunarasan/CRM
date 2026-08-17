package com.arudra.crm.dto;

import lombok.Data;

/** Optional middle step: check an OTP is valid before showing the new-password fields. */
@Data
public class VerifyOtpRequest {
    private String email;
    private String otp;
}

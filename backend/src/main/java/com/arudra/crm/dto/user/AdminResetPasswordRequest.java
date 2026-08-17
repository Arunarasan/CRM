package com.arudra.crm.dto.user;

import lombok.Data;

/** Admin sets a user's password directly (no OTP), e.g. onboarding or account recovery. */
@Data
public class AdminResetPasswordRequest {
    private String newPassword;
}

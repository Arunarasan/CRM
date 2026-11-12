package com.arudra.crm.dto;

import lombok.Data;

@Data
public class ForgotPasswordRequest {
    @jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max = 254)
    private String email;
}

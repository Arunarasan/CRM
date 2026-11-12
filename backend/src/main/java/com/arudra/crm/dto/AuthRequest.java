package com.arudra.crm.dto;

import lombok.Data;

@Data
public class AuthRequest {
    @jakarta.validation.constraints.Size(max = 254)
    private String email;
    @jakarta.validation.constraints.Size(max = 200)
    private String password;
    private boolean rememberMe;
}

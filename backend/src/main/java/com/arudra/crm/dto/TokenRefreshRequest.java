package com.arudra.crm.dto;

import lombok.Data;

@Data
public class TokenRefreshRequest {
    private String refreshToken;
}

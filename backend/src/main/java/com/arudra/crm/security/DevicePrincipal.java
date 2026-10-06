package com.arudra.crm.security;

/**
 * The authenticated attendance terminal behind a device-token request. {@link #toString()} is what
 * {@code Authentication#getName()} returns, so audit columns read e.g. "device:ARUDRA-ATT-0001".
 */
public record DevicePrincipal(Long deviceId, String deviceCode) {
    public static final String AUTHORITY = "ROLE_ATTENDANCE_DEVICE";

    @Override
    public String toString() {
        return "device:" + deviceCode;
    }
}

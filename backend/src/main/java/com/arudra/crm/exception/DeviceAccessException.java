package com.arudra.crm.exception;

/**
 * A terminal-facing access failure with a stable machine-readable {@link #code} (returned as
 * {@code ApiError.error}) so the Android app can show the right screen: e.g. DEVICE_BLOCKED,
 * DEVICE_REVOKED, DEVICE_PENDING, INVALID_CREDENTIAL, RATE_LIMITED.
 */
public class DeviceAccessException extends RuntimeException {
    private final int status;
    private final String code;

    public DeviceAccessException(int status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public int getStatus() { return status; }
    public String getCode() { return code; }

    public static DeviceAccessException forbidden(String code, String message) {
        return new DeviceAccessException(403, code, message);
    }

    public static DeviceAccessException unauthorized(String code, String message) {
        return new DeviceAccessException(401, code, message);
    }
}

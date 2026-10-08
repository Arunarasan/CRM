package com.arudra.crm.exception;

/** A clock action was refused because it didn't come from the user's registered phone (HARD mode). */
public class DeviceNotAuthorizedException extends RuntimeException {
    public DeviceNotAuthorizedException(String message) {
        super(message);
    }
}

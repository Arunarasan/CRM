package com.arudra.crm.entity;

/** Lifecycle states of an {@link AttendanceDevice}. Only {@link #ACTIVE} devices may record attendance. */
public final class AttendanceDeviceStatus {
    public static final String PENDING = "PENDING";
    public static final String ACTIVE = "ACTIVE";
    public static final String BLOCKED = "BLOCKED";
    public static final String REVOKED = "REVOKED";
    public static final String REJECTED = "REJECTED";
    /** Display-only: an ACTIVE device not seen within the heartbeat window. Never persisted. */
    public static final String OFFLINE = "OFFLINE";

    private AttendanceDeviceStatus() {}
}

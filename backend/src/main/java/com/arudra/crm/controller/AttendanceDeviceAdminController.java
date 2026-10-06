package com.arudra.crm.controller;

import com.arudra.crm.dto.attendance.DeviceApi.*;
import com.arudra.crm.service.AttendanceDeviceService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** HR → Attendance → Devices. Device approval and security actions require HR write access. */
@RestController
@RequestMapping("/api/hr/attendance-devices")
public class AttendanceDeviceAdminController {

    private static final String HR_READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ')";
    private static final String HR_WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE')";

    private final AttendanceDeviceService deviceService;

    public AttendanceDeviceAdminController(AttendanceDeviceService deviceService) {
        this.deviceService = deviceService;
    }

    @GetMapping
    @PreAuthorize(HR_READ)
    public List<DeviceView> list() {
        return deviceService.list();
    }

    @GetMapping("/{id}")
    @PreAuthorize(HR_READ)
    public DeviceView get(@PathVariable Long id) {
        return deviceService.get(id);
    }

    /** Admin "Register Device": creates a pre-approved slot and returns a one-time pairing code. */
    @PostMapping
    @PreAuthorize(HR_WRITE)
    public AdminCreateResponse register(@RequestBody AdminCreateRequest req) {
        return deviceService.adminCreate(req);
    }

    @PostMapping("/{id}/pairing-code")
    @PreAuthorize(HR_WRITE)
    public AdminCreateResponse pairingCode(@PathVariable Long id) {
        return deviceService.regeneratePairingCode(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize(HR_WRITE)
    public DeviceView update(@PathVariable Long id, @RequestBody DeviceUpdateRequest req) {
        return deviceService.update(id, req);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize(HR_WRITE)
    public DeviceView approve(@PathVariable Long id, @RequestBody(required = false) DeviceActionRequest req) {
        return deviceService.approve(id, req);
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize(HR_WRITE)
    public DeviceView reject(@PathVariable Long id, @RequestBody(required = false) DeviceActionRequest req) {
        return deviceService.reject(id, req);
    }

    @PostMapping("/{id}/block")
    @PreAuthorize(HR_WRITE)
    public DeviceView block(@PathVariable Long id, @RequestBody(required = false) DeviceActionRequest req) {
        return deviceService.block(id, req);
    }

    @PostMapping("/{id}/unblock")
    @PreAuthorize(HR_WRITE)
    public DeviceView unblock(@PathVariable Long id) {
        return deviceService.unblock(id);
    }

    @PostMapping("/{id}/revoke")
    @PreAuthorize(HR_WRITE)
    public DeviceView revoke(@PathVariable Long id, @RequestBody(required = false) DeviceActionRequest req) {
        return deviceService.revoke(id, req);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(HR_WRITE)
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        deviceService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/activity")
    @PreAuthorize(HR_READ)
    public List<DeviceEventView> activity(@PathVariable Long id, @RequestParam(defaultValue = "100") int limit) {
        return deviceService.activity(id, limit);
    }
}

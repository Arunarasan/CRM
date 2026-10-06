package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.CallRecordingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Tasks & Workforce → Call Recordings. Managers upload recordings and raise follow-up tasks; the
 * employee on a call task records its outcome (lead / add to lead / not a lead) through the
 * outcome endpoints, which the service limits to that task's assignee.
 */
@RestController
@RequestMapping("/api/call-recordings")
@RequiredArgsConstructor
public class CallRecordingController {

    private static final String MANAGE = "hasAuthority('ROLE_ADMIN') or hasAuthority('ROLE_MANAGER') "
            + "or hasAuthority('ROLE_PROJECT_MANAGER') or hasAuthority('TASK_ASSIGN')";

    private final CallRecordingService service;
    private final CurrentUserService currentUserService;

    @GetMapping
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> list() {
        return ResponseEntity.ok(ApiResponse.success(service.list()));
    }

    @PostMapping
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "lastModified", required = false) Long lastModified,
            @RequestParam(value = "durationSec", required = false) Integer durationSec) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(
                service.upload(file, lastModified, durationSec, currentUserService.getCurrentUser())));
    }

    @PutMapping("/{id}")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(service.update(id, body)));
    }

    @PostMapping("/{id}/make-playable")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Map<String, Object>>> makePlayable(@PathVariable Long id) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(service.makePlayable(id), "Recording converted."));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<Void>> discard(@PathVariable Long id) {
        service.discard(id, currentUserService.getCurrentUser());
        return ResponseEntity.ok(ApiResponse.success(null, "Recording removed."));
    }

    @PostMapping("/tasks")
    @PreAuthorize(MANAGE)
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> createTasks(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> rawIds = (List<Object>) body.getOrDefault("ids", List.of());
        List<Long> ids = rawIds.stream().map(o -> Long.valueOf(o.toString())).toList();
        Object rid = body.get("resourceId");
        Object due = body.get("dueDate");
        return ResponseEntity.ok(ApiResponse.success(service.createTasks(ids,
                (String) body.get("resourceType"),
                rid == null ? null : Long.valueOf(rid.toString()),
                due == null || due.toString().isBlank() ? null : LocalDate.parse(due.toString()),
                (String) body.get("priority"),
                currentUserService.getCurrentUser())));
    }

    // --- employee app: my own calls ----------------------------------------------------------

    @GetMapping("/mine")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> mine() {
        return ResponseEntity.ok(ApiResponse.success(service.mine(currentUserService.getCurrentUser())));
    }

    /** Upload one of my calls — it becomes a Collect Requirement task assigned to me. */
    @PostMapping("/mine")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadMine(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "lastModified", required = false) Long lastModified,
            @RequestParam(value = "durationSec", required = false) Integer durationSec,
            @RequestParam(value = "note", required = false) String note) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(service.uploadMine(file, lastModified, durationSec, note,
                currentUserService.getCurrentUser()), "Call uploaded — a Collect Requirement task was created for you."));
    }

    // --- used from the task screens (manager or the task's assignee) -------------------------

    @GetMapping("/task/{taskId}/calls")
    public ResponseEntity<ApiResponse<Map<String, Object>>> callsForTask(@PathVariable Long taskId) {
        return ResponseEntity.ok(ApiResponse.success(service.callsForTask(taskId, currentUserService.getCurrentUser())));
    }

    @PostMapping("/task/{taskId}/upload")
    public ResponseEntity<ApiResponse<Map<String, Object>>> uploadForTask(
            @PathVariable Long taskId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "lastModified", required = false) Long lastModified,
            @RequestParam(value = "durationSec", required = false) Integer durationSec) throws IOException {
        return ResponseEntity.ok(ApiResponse.success(service.uploadForTask(taskId, file, lastModified, durationSec,
                currentUserService.getCurrentUser()), "Recording added to the lead."));
    }

    @PostMapping("/{id}/add-to-task/{taskId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addToTaskLead(@PathVariable Long id, @PathVariable Long taskId) {
        return ResponseEntity.ok(ApiResponse.success(
                service.addToTaskLead(id, taskId, currentUserService.getCurrentUser()), "Call added to the lead."));
    }

    @GetMapping("/by-task/{taskId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> forTask(@PathVariable Long taskId) {
        return ResponseEntity.ok(ApiResponse.success(service.forTask(taskId, currentUserService.getCurrentUser())));
    }

    @GetMapping("/by-lead/{leadId}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN') or hasAuthority('LEAD_READ') or hasAuthority('PROJECT_READ')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> forLead(@PathVariable Long leadId) {
        return ResponseEntity.ok(ApiResponse.success(service.forLead(leadId)));
    }

    @PostMapping("/{id}/lead")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createLead(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(
                service.createLead(id, body, currentUserService.getCurrentUser()), "Lead created."));
    }

    @PostMapping("/{id}/attach-lead")
    public ResponseEntity<ApiResponse<Map<String, Object>>> attachToLead(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Object leadId = body.get("leadId");
        if (leadId == null) throw new IllegalArgumentException("Pick the lead to add this call to.");
        return ResponseEntity.ok(ApiResponse.success(service.attachToLead(id, Long.valueOf(leadId.toString()),
                (String) body.get("note"), currentUserService.getCurrentUser()), "Call added to the lead."));
    }

    @PostMapping("/{id}/not-a-lead")
    public ResponseEntity<ApiResponse<Map<String, Object>>> notALead(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(ApiResponse.success(
                service.notALead(id, (String) body.get("reason"), currentUserService.getCurrentUser()), "Call closed."));
    }
}

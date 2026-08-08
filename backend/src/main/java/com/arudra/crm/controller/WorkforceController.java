package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.dto.workforce.WorkforceDetailView;
import com.arudra.crm.dto.workforce.WorkforceListRow;
import com.arudra.crm.dto.workforce.WorkforceRequest;
import com.arudra.crm.dto.workforce.WorkforceResourceView;
import com.arudra.crm.entity.WorkforceDocument;
import com.arudra.crm.service.WorkforceResourceService;
import com.arudra.crm.service.WorkforceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Unified Workforce module. Two concerns live here:
 *  - Master data: one "Add Workforce" flow, one directory, one profile, reports (this file's new part).
 *  - Assignment view: employees + contractors as one assignable pool for the Project module
 *    (the pre-existing /resources and /dashboard endpoints).
 * HR still owns employee payroll/leave and the Contractor module still owns work-packages/bills;
 * this module deep-links into them.
 */
@RestController
@RequestMapping("/api/workforce")
@CrossOrigin(origins = "*")
public class WorkforceController {

    private static final String READ =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_READ') or hasAuthority('EMPLOYEE_READ') " +
            "or hasAuthority('CONTRACTOR_READ') or hasAuthority('PROJECT_READ') or hasAuthority('EMPLOYEE_TASK_READ')";
    private static final String WRITE =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('WORKFORCE_WRITE') or hasAuthority('EMPLOYEE_WRITE') " +
            "or hasAuthority('CONTRACTOR_WRITE')";

    @Autowired private WorkforceResourceService workforceResourceService;
    @Autowired private WorkforceService workforceService;

    // ---------------------------------------------------------- master data
    /** Unified directory: employees + contractors in one filterable list. */
    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<WorkforceListRow>>> list(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String skill,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String company,
            @RequestParam(required = false) String search) {
        return ResponseEntity.ok(ApiResponse.success(
                workforceService.list(type, skill, status, department, company, search)));
    }

    @GetMapping("/meta")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> meta() {
        return ResponseEntity.ok(ApiResponse.success(workforceService.meta()));
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<WorkforceDetailView>> get(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(workforceService.get(id)));
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<WorkforceDetailView>> create(@RequestBody WorkforceRequest req) {
        return ResponseEntity.ok(ApiResponse.success(workforceService.create(req)));
    }

    @PutMapping("/{id}")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<WorkforceDetailView>> update(
            @PathVariable Long id, @RequestBody WorkforceRequest req) {
        return ResponseEntity.ok(ApiResponse.success(workforceService.update(id, req)));
    }

    @GetMapping("/{id}/documents")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<WorkforceDocument>>> documents(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(workforceService.listDocuments(id)));
    }

    @PostMapping("/{id}/documents")
    @PreAuthorize(WRITE)
    public ResponseEntity<ApiResponse<WorkforceDocument>> addDocument(
            @PathVariable Long id, @RequestBody WorkforceDocument doc) {
        return ResponseEntity.ok(ApiResponse.success(workforceService.addDocument(id, doc)));
    }

    @GetMapping("/reports/{type}")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> report(@PathVariable String type) {
        return ResponseEntity.ok(ApiResponse.success(workforceService.report(type)));
    }

    /** Unified financial view: employee payroll or contractor payments, by workforce type. */
    @GetMapping("/{id}/finance")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> finance(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(workforceService.finance(id)));
    }

    // ------------------------------------------------------ assignment view
    /** Merged, filterable list of assignable resources for the unified project picker. */
    @GetMapping("/resources")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<List<WorkforceResourceView>>> listResources(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type) {
        return ResponseEntity.ok(ApiResponse.success(workforceResourceService.list(search, type)));
    }

    /** Unified task dashboard across both employees and contractors. */
    @GetMapping("/dashboard")
    @PreAuthorize(READ)
    public ResponseEntity<ApiResponse<Map<String, Object>>> dashboard() {
        return ResponseEntity.ok(ApiResponse.success(workforceResourceService.dashboard()));
    }
}

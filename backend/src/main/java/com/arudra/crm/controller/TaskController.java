package com.arudra.crm.controller;

import com.arudra.crm.dto.ApiResponse;
import com.arudra.crm.entity.*;
import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.TaskService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    // New Enterprise PM endpoints use this; legacy endpoints below are left unauthenticated
    // beyond SecurityConfig's blanket authenticated() to avoid regressing existing flows.
    private static final String ASSIGN = "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_ASSIGN')";

    @Autowired
    private TaskService taskService;

    @Autowired
    private CurrentUserService currentUserService;

    @Autowired
    private com.arudra.crm.service.TaskChecklistService taskChecklistService;

    // --- Checklist (desktop / manager side) -------------------------------------------------
    /** All checklists for a task (compact maps). */
    @GetMapping("/{id}/checklist")
    public ResponseEntity<List<Map<String, Object>>> getChecklist(@PathVariable Long id) {
        return ResponseEntity.ok(taskChecklistService.getChecklists(id));
    }

    /** (Re)apply a starter checklist. Body optional: {"template":"AUTO"|"ELECTRICAL"|...}. */
    @PostMapping("/{id}/checklist/apply")
    public ResponseEntity<Map<String, Object>> applyChecklist(@PathVariable Long id,
                                                              @RequestBody(required = false) Map<String, String> body) {
        String template = body == null ? null : body.get("template");
        return ResponseEntity.ok(taskChecklistService.applyTemplate(id, template));
    }

    /** Add a single custom checklist item. Body: {"content":"...", "checklistName":"Work Steps"}. */
    @PostMapping("/{id}/checklist/items")
    public ResponseEntity<Map<String, Object>> addChecklistItem(@PathVariable Long id,
                                                               @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(taskChecklistService.addItem(id, body.get("checklistName"), body.get("content")));
    }

    /** Toggle a checklist item's completed state. */
    @PostMapping("/checklist-items/{itemId}/toggle")
    public ResponseEntity<Map<String, Object>> toggleChecklistItem(@PathVariable Long itemId) {
        return ResponseEntity.ok(taskChecklistService.toggleItem(itemId));
    }

    @GetMapping
    public ResponseEntity<Page<Task>> getAllTasks(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(taskService.getTasks(search, page, size));
    }
    
    @GetMapping("/all")
    public ResponseEntity<List<Task>> getTasksUnpaginated() {
        return ResponseEntity.ok(taskService.getAllTasks());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getTaskDetails(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getTaskDetails(id));
    }

    @GetMapping("/{id}/assignments")
    public ResponseEntity<List<Map<String, Object>>> getAssignments(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getAssignments(id));
    }

    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<Task>> getTasksByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(taskService.getTasksByProject(projectId));
    }

    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody Task task) {
        return ResponseEntity.ok(taskService.createTask(task));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody Task task) {
        return ResponseEntity.ok(taskService.updateTask(id, task));
    }
    
    @PutMapping("/{id}/status")
    public ResponseEntity<Void> updateTaskStatusAndOrder(
            @PathVariable Long id, 
            @RequestBody Map<String, Object> payload) {
        taskService.updateTaskStatusAndOrder(
            id, 
            (String) payload.get("status"), 
            (Integer) payload.get("orderIndex")
        );
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.ok().build();
    }
    
    @PostMapping("/{id}/comments")
    public ResponseEntity<TaskComment> addComment(
            @PathVariable Long id,
            @RequestBody TaskComment comment) {
        return ResponseEntity.ok(taskService.addComment(id, comment, currentUserService.getCurrentUser()));
    }
    
    @PostMapping("/{id}/attachments")
    public ResponseEntity<TaskAttachment> addAttachment(
            @PathVariable Long id,
            @RequestBody TaskAttachment attachment) {
        return ResponseEntity.ok(taskService.addAttachment(id, attachment));
    }

    @PutMapping("/{id}/assign")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<ApiResponse<Task>> assignTask(@PathVariable Long id, @RequestBody Map<String, Long> payload) {
        Task task = taskService.assignTask(id,
                payload.get("phaseId"), payload.get("roomId"), payload.get("contractorId"), payload.get("employeeId"));
        return ResponseEntity.ok(ApiResponse.success(task));
    }

    @PostMapping("/{id}/dependencies")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<ApiResponse<Task>> addDependency(@PathVariable Long id, @RequestBody Map<String, Long> payload) {
        return ResponseEntity.ok(ApiResponse.success(taskService.addDependency(id, payload.get("dependsOnTaskId"))));
    }

    @DeleteMapping("/{id}/dependencies/{dependsOnTaskId}")
    @PreAuthorize(ASSIGN)
    public ResponseEntity<ApiResponse<Task>> removeDependency(@PathVariable Long id, @PathVariable Long dependsOnTaskId) {
        return ResponseEntity.ok(ApiResponse.success(taskService.removeDependency(id, dependsOnTaskId)));
    }
}

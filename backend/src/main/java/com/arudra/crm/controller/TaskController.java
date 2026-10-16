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
public class TaskController {

    // Every endpoint is role-gated: customer-portal and contractor logins hold none of these.
    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_READ') "
            + "or hasAuthority('PROJECT_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_WRITE') "
            + "or hasAuthority('PROJECT_WRITE')";
    // Field employees (EMPLOYEE_TASK_*) may read/act on a task only when they are assigned to it.
    private static final String READ_OR_ASSIGNEE = "(" + READ + ") or "
            + "(hasAuthority('EMPLOYEE_TASK_READ') and @taskAccess.canAct(#id))";
    private static final String WRITE_OR_ASSIGNEE = "(" + WRITE + ") or "
            + "(hasAuthority('EMPLOYEE_TASK_EXECUTE') and @taskAccess.canAct(#id))";
    private static final String ASSIGN = "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_ASSIGN')";
    // Deleting a task is destructive — restricted to approvers.
    private static final String DELETE =
            "hasAuthority('ROLE_ADMIN') or hasAuthority('TASK_APPROVE') "
            + "or hasAuthority('ROLE_MANAGER') or hasAuthority('ROLE_PROJECT_MANAGER')";

    @Autowired
    private TaskService taskService;

    @Autowired
    private CurrentUserService currentUserService;

    @Autowired
    private com.arudra.crm.service.TaskChecklistService taskChecklistService;

    // --- Checklist (desktop / manager side) -------------------------------------------------
    /** All checklists for a task (compact maps). */
    @PreAuthorize(READ_OR_ASSIGNEE)
    @GetMapping("/{id}/checklist")
    public ResponseEntity<List<Map<String, Object>>> getChecklist(@PathVariable Long id) {
        return ResponseEntity.ok(taskChecklistService.getChecklists(id));
    }

    /** (Re)apply a starter checklist. Body optional: {"template":"AUTO"|"ELECTRICAL"|...}. */
    @PreAuthorize(WRITE)
    @PostMapping("/{id}/checklist/apply")
    public ResponseEntity<Map<String, Object>> applyChecklist(@PathVariable Long id,
                                                              @RequestBody(required = false) Map<String, String> body) {
        String template = body == null ? null : body.get("template");
        return ResponseEntity.ok(taskChecklistService.applyTemplate(id, template));
    }

    /** Add a single custom checklist item. Body: {"content":"...", "checklistName":"Work Steps"}. */
    @PreAuthorize(WRITE_OR_ASSIGNEE)
    @PostMapping("/{id}/checklist/items")
    public ResponseEntity<Map<String, Object>> addChecklistItem(@PathVariable Long id,
                                                               @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(taskChecklistService.addItem(id, body.get("checklistName"), body.get("content")));
    }

    /** Toggle a checklist item's completed state. */
    @PreAuthorize("(" + WRITE + ") or (hasAuthority('EMPLOYEE_TASK_EXECUTE') and @taskAccess.canActOnChecklistItem(#itemId))")
    @PostMapping("/checklist-items/{itemId}/toggle")
    public ResponseEntity<Map<String, Object>> toggleChecklistItem(@PathVariable Long itemId) {
        return ResponseEntity.ok(taskChecklistService.toggleItem(itemId));
    }

    @PreAuthorize(READ)
    @GetMapping
    public ResponseEntity<Page<Task>> getAllTasks(
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(taskService.getTasks(search, page, size));
    }
    
    @PreAuthorize(READ)
    @GetMapping("/all")
    public ResponseEntity<List<Task>> getTasksUnpaginated() {
        return ResponseEntity.ok(taskService.getAllTasks());
    }

    @PreAuthorize(READ_OR_ASSIGNEE)
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getTaskDetails(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getTaskDetails(id));
    }

    @PreAuthorize(READ_OR_ASSIGNEE)
    @GetMapping("/{id}/assignments")
    public ResponseEntity<List<Map<String, Object>>> getAssignments(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getAssignments(id));
    }

    @PreAuthorize(READ)
    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<Task>> getTasksByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(taskService.getTasksByProject(projectId));
    }

    @PreAuthorize(WRITE)
    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody Task task) {
        return ResponseEntity.ok(taskService.createTask(task));
    }

    @PreAuthorize(WRITE)
    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody Task task) {
        return ResponseEntity.ok(taskService.updateTask(id, task));
    }
    
    /** Focused edit (name / priority / due date / description / status) that preserves the
     *  task's project, assignment and workflow links — used by the project task board. */
    @PreAuthorize(WRITE)
    @PutMapping("/{id}/basics")
    public ResponseEntity<Task> editTaskBasics(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Object due = body.get("dueDate");
        java.time.LocalDate dueDate = (due == null || String.valueOf(due).isBlank())
                ? null : java.time.LocalDate.parse(String.valueOf(due));
        return ResponseEntity.ok(taskService.editTaskBasics(
                id,
                (String) body.get("taskName"),
                (String) body.get("priority"),
                (String) body.get("status"),
                dueDate,
                (String) body.get("description")));
    }

    /** Set a task's completion percent (0-100) and optional stage — drives the project handover bar. */
    @PreAuthorize(WRITE_OR_ASSIGNEE)
    @PutMapping("/{id}/progress")
    public ResponseEntity<Task> updateTaskProgress(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        Integer progress = body.get("progress") != null ? ((Number) body.get("progress")).intValue() : null;
        String stage = (String) body.get("stage");
        return ResponseEntity.ok(taskService.updateTaskProgress(id, progress, stage));
    }

    @PreAuthorize(WRITE)
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
    @PreAuthorize(DELETE)
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.ok().build();
    }
    
    @PreAuthorize(WRITE_OR_ASSIGNEE)
    @PostMapping("/{id}/comments")
    public ResponseEntity<TaskComment> addComment(
            @PathVariable Long id,
            @RequestBody TaskComment comment) {
        return ResponseEntity.ok(taskService.addComment(id, comment, currentUserService.getCurrentUser()));
    }
    
    @PreAuthorize(WRITE_OR_ASSIGNEE)
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

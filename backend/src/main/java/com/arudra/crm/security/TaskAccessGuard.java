package com.arudra.crm.security;

import com.arudra.crm.entity.Task;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.TaskAssignmentRepository;
import com.arudra.crm.repository.TaskChecklistItemRepository;
import com.arudra.crm.repository.TaskRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assignee check for field employees acting on legacy /api/tasks endpoints (used from
 * {@code @PreAuthorize} as {@code @taskAccess.canAct(#id)}). Staff holding TASK_WRITE skip
 * this; an employee may only touch a task they are the primary assignee of, or hold an
 * assignment row on.
 */
@Component("taskAccess")
public class TaskAccessGuard {

    private final CurrentUserService currentUserService;
    private final TaskRepository taskRepository;
    private final TaskAssignmentRepository assignmentRepository;
    private final TaskChecklistItemRepository checklistItemRepository;

    public TaskAccessGuard(CurrentUserService currentUserService, TaskRepository taskRepository,
                           TaskAssignmentRepository assignmentRepository,
                           TaskChecklistItemRepository checklistItemRepository) {
        this.currentUserService = currentUserService;
        this.taskRepository = taskRepository;
        this.assignmentRepository = assignmentRepository;
        this.checklistItemRepository = checklistItemRepository;
    }

    @Transactional(readOnly = true)
    public boolean canAct(Long taskId) {
        User user = currentUserService.getCurrentUser();
        if (user == null || taskId == null) return false;
        Task task = taskRepository.findById(taskId).orElse(null);
        if (task == null) return false;
        if (task.getAssignedEmployee() != null && user.getId().equals(task.getAssignedEmployee().getId())) {
            return true;
        }
        return assignmentRepository.findByTaskIdAndEmployeeId(taskId, user.getId()).isPresent();
    }

    @Transactional(readOnly = true)
    public boolean canActOnChecklistItem(Long itemId) {
        return checklistItemRepository.findById(itemId)
                .map(item -> item.getChecklist() != null && item.getChecklist().getTask() != null
                        && canAct(item.getChecklist().getTask().getId()))
                .orElse(false);
    }
}

package com.arudra.crm.service;

import com.arudra.crm.entity.*;
import com.arudra.crm.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class TaskService {

    @Autowired
    private TaskRepository taskRepository;
    
    @Autowired
    private TaskCommentRepository commentRepository;
    
    @Autowired
    private TaskAttachmentRepository attachmentRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private ProjectPhaseRepository phaseRepository;

    @Autowired
    private ProjectRoomRepository roomRepository;

    @Autowired
    private ContractorRepository contractorRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private TaskAssignmentRepository taskAssignmentRepository;

    @Autowired
    private TaskChecklistService taskChecklistService;

    /** Compact assignment list for the desktop Tasks dialog — deliberately not the raw entity (avoids dumping the full User->roles->permissions graph). */
    public List<Task> getTasksByProject(Long projectId) {
        return taskRepository.findByProjectId(projectId);
    }

    public List<Map<String, Object>> getAssignments(Long taskId) {
        return taskAssignmentRepository.findByTaskId(taskId).stream()
                .map(a -> Map.<String, Object>of(
                        "employeeId", a.getEmployee() != null ? a.getEmployee().getId() : 0L,
                        "employeeName", a.getEmployee() != null ? a.getEmployee().getName() : "Unknown",
                        "role", a.getRole() == null ? "" : a.getRole(),
                        "status", a.getStatus()
                ))
                .toList();
    }

    public Page<Task> getTasks(String search, int page, int size) {
        // Order by orderIndex for Kanban support, then by id descending
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("orderIndex").ascending().and(Sort.by("id").descending()));
        if (search != null && !search.isEmpty()) {
            return taskRepository.searchTasks(search, pageRequest);
        }
        return taskRepository.findAll(pageRequest);
    }
    
    // For Kanban view without pagination
    public List<Task> getAllTasks() {
        return taskRepository.findAll(Sort.by("orderIndex").ascending().and(Sort.by("id").descending()));
    }

    public Task getTaskById(Long id) {
        return taskRepository.findById(id).orElseThrow(() -> new RuntimeException("Task not found"));
    }
    
    public Map<String, Object> getTaskDetails(Long id) {
        Task task = getTaskById(id);
        List<TaskComment> comments = commentRepository.findByTaskIdOrderByCreatedAtDesc(id);
        List<TaskAttachment> attachments = attachmentRepository.findByTaskId(id);
        
        return Map.of(
            "task", task,
            "comments", comments,
            "attachments", attachments
        );
    }

    public Task createTask(Task task) {
        if (task.getParentTask() != null && task.getParentTask().getId() != null) {
            task.setParentTask(getTaskById(task.getParentTask().getId()));
        }
        Task savedTask = taskRepository.save(task);

        // Seed a basic, trade-aware checklist so whoever is assigned immediately knows the work steps.
        taskChecklistService.ensureDefaultChecklist(savedTask);

        // Trigger Notification
        if (savedTask.getAssignedEmployee() != null) {
            notificationService.dispatch(
                "New Task Assigned",
                "You have been assigned to: " + savedTask.getTaskName(),
                "TASK",
                savedTask.getAssignedEmployee().getId(),
                "/tasks/" + savedTask.getId()
            );
        }
        
        return savedTask;
    }

    public Task updateTask(Long id, Task taskDetails) {
        Task task = getTaskById(id);
        task.setTaskName(taskDetails.getTaskName());
        task.setDescription(taskDetails.getDescription());
        task.setProject(taskDetails.getProject());
        task.setAssignedEmployee(taskDetails.getAssignedEmployee());
        task.setStartDate(taskDetails.getStartDate());
        task.setDueDate(taskDetails.getDueDate());
        task.setStatus(taskDetails.getStatus());
        task.setPriority(taskDetails.getPriority());
        task.setIsRecurring(taskDetails.getIsRecurring());
        task.setRecurringPattern(taskDetails.getRecurringPattern());
        task.setEstimatedHours(taskDetails.getEstimatedHours());
        task.setActualHours(taskDetails.getActualHours());
        task.setRequiredSkills(taskDetails.getRequiredSkills());
        task.setOrderIndex(taskDetails.getOrderIndex());
        
        // Handle subtasks
        if (taskDetails.getParentTask() != null && taskDetails.getParentTask().getId() != null) {
            task.setParentTask(getTaskById(taskDetails.getParentTask().getId()));
        } else {
            task.setParentTask(null);
        }
        
        return taskRepository.save(task);
    }
    
    public void updateTaskStatusAndOrder(Long id, String status, Integer orderIndex) {
        Task task = getTaskById(id);
        task.setStatus(status);
        task.setOrderIndex(orderIndex);
        taskRepository.save(task);
    }

    public void deleteTask(Long id) {
        Task task = getTaskById(id);
        taskRepository.delete(task);
    }
    
    public TaskComment addComment(Long taskId, TaskComment comment, User user) {
        Task task = getTaskById(taskId);
        comment.setTask(task);
        comment.setAuthor(user);
        return commentRepository.save(comment);
    }
    
    public TaskAttachment addAttachment(Long taskId, TaskAttachment attachment) {
        Task task = getTaskById(taskId);
        attachment.setTask(task);
        return attachmentRepository.save(attachment);
    }

    /** Assigns a task's phase/room/contractor/employee in one call, firing a task-assigned notification. */
    public Task assignTask(Long taskId, Long phaseId, Long roomId, Long contractorId, Long employeeId) {
        Task task = getTaskById(taskId);

        if (phaseId != null) {
            task.setPhase(phaseRepository.findById(phaseId)
                    .orElseThrow(() -> new RuntimeException("Project phase not found")));
        }
        if (roomId != null) {
            task.setRoom(roomRepository.findById(roomId)
                    .orElseThrow(() -> new RuntimeException("Project room not found")));
        }
        if (contractorId != null) {
            task.setContractor(contractorRepository.findById(contractorId)
                    .orElseThrow(() -> new RuntimeException("Contractor not found")));
        }
        if (employeeId != null) {
            task.setAssignedEmployee(userRepository.findById(employeeId)
                    .orElseThrow(() -> new RuntimeException("Employee not found")));
        }

        Task saved = taskRepository.save(task);

        if (saved.getAssignedEmployee() != null) {
            notificationService.dispatch(
                    "Task Assigned",
                    "You have been assigned to: " + saved.getTaskName(),
                    "TASK",
                    saved.getAssignedEmployee().getId(),
                    "/tasks/" + saved.getId());
        }

        return saved;
    }

    public Task addDependency(Long taskId, Long dependsOnTaskId) {
        Task task = getTaskById(taskId);
        Task dependsOn = getTaskById(dependsOnTaskId);
        task.getDependencies().add(dependsOn);
        return taskRepository.save(task);
    }

    public Task removeDependency(Long taskId, Long dependsOnTaskId) {
        Task task = getTaskById(taskId);
        task.getDependencies().removeIf(d -> d.getId().equals(dependsOnTaskId));
        return taskRepository.save(task);
    }
}

package com.arudra.crm.dto;

import com.arudra.crm.entity.Task;

public class TaskMapper {
    public static TaskDTO toDTO(Task task) {
        if (task == null) return null;
        TaskDTO dto = new TaskDTO();
        dto.setId(task.getId());
        dto.setName(task.getTaskName());
        dto.setPriority(task.getPriority());
        dto.setStatus(task.getStatus());
        dto.setStartDate(task.getStartDate());
        dto.setDueDate(task.getDueDate());

        if (task.getProject() != null) {
            TaskDTO.ProjectSummaryDTO pDto = new TaskDTO.ProjectSummaryDTO();
            pDto.setId(task.getProject().getId());
            pDto.setName(task.getProject().getProjectName());
            dto.setProject(pDto);
        }

        if (task.getAssignedEmployee() != null) {
            TaskDTO.UserSummaryDTO uDto = new TaskDTO.UserSummaryDTO();
            uDto.setId(task.getAssignedEmployee().getId());
            uDto.setName(task.getAssignedEmployee().getName());
            dto.setAssignedEmployee(uDto);
        }

        return dto;
    }
}

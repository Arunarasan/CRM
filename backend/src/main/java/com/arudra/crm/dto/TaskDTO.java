package com.arudra.crm.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class TaskDTO {
    private Long id;
    private String name; // mapped from taskName
    private ProjectSummaryDTO project;
    private UserSummaryDTO assignedEmployee;
    private String priority;
    private String status;
    private LocalDate startDate;
    private LocalDate dueDate;

    @Data
    public static class ProjectSummaryDTO {
        private Long id;
        private String name; // mapped from projectName
    }

    @Data
    public static class UserSummaryDTO {
        private Long id;
        private String name;
    }
}

package com.arudra.crm.entity;

import com.arudra.crm.util.StringListConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** "Done today / plan for tomorrow" entry on a project task, with how far the bar moved. */
@Getter
@Setter
@Entity
@Table(name = "project_task_daily_logs")
public class ProjectTaskDailyLog extends BaseEntity {

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "log_date", nullable = false)
    private LocalDate logDate;

    @Column(name = "work_done", columnDefinition = "TEXT")
    private String workDone;

    @Column(name = "tomorrow_plan", columnDefinition = "TEXT")
    private String tomorrowPlan;

    @Column(name = "percent_before")
    private Integer percentBefore;

    @Column(name = "percent_after")
    private Integer percentAfter;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<String> photos = new ArrayList<>();

    @Column(name = "audio_url", length = 500)
    private String audioUrl;

    @Column(name = "author_id")
    private Long authorId;

    @Column(name = "author_name", length = 150)
    private String authorName;
}

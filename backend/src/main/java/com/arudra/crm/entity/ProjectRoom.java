package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

/** A room within a Project Phase (e.g. "Living Room", "Kitchen"). Structure: Project -> Phase -> Room -> Items. */
@Getter
@Setter
@Entity
@Table(name = "project_rooms", indexes = {
    @Index(name = "idx_pr_phase", columnList = "phase_id")
})
public class ProjectRoom extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "phase_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project"})
    private ProjectPhase phase;

    @NotBlank
    @Column(name = "room_name", nullable = false, length = 150)
    private String roomName;

    @Column(name = "floor_name", length = 100)
    private String floorName;

    @Column(name = "room_type", length = 100)
    private String roomType;

    @Column(name = "completion_percentage")
    private Integer completionPercentage = 0;

    /** Auto-maintained by the rollup — users never set this by hand. */
    @Column(length = 50)
    private String status = "PENDING"; // PENDING, IN_PROGRESS, COMPLETED, ON_HOLD

    @Column(name = "completed_date")
    private java.time.LocalDate completedDate;

    @Column(columnDefinition = "TEXT")
    private String remarks;

    @JsonIgnore
    @OneToMany(mappedBy = "room", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<ProjectRoomItem> items = new java.util.ArrayList<>();
}

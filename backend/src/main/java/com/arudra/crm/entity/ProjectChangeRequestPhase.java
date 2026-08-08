package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * A single activate/deactivate line within a {@link ProjectChangeRequest} — the structured, executable
 * form of "deactivate First Floor" / "activate First Floor + Kitchen + Wardrobe."
 */
@Getter
@Setter
@Entity
@Table(name = "project_change_request_phases")
public class ProjectChangeRequestPhase extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "change_request_id", nullable = false)
    private ProjectChangeRequest changeRequest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_phase_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "project"})
    private ProjectPhase projectPhase;

    @Column(nullable = false, length = 20)
    private String action; // ACTIVATE, DEACTIVATE
}

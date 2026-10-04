package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * A step one work line goes through: MATERIAL, MANUFACTURE, STITCHING or DELIVERY. A MATERIAL step whose
 * product is on a project purchase order is read from the PO instead of the stored percent.
 */
@Getter
@Setter
@Entity
@Table(name = "project_work_line_steps")
public class ProjectWorkLineStep extends BaseEntity {

    @Column(name = "work_line_id", nullable = false)
    private Long workLineId;

    @Column(name = "step_type", nullable = false, length = 20)
    private String stepType;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(nullable = false)
    private Integer percent = 0;

    @Column(nullable = false, length = 20)
    private String status = "PENDING"; // PENDING, IN_PROGRESS, DONE

    @Column(name = "delivery_route", length = 10)
    private String deliveryRoute; // DIRECT, PICKUP

    @Column(name = "delivery_stage", length = 20)
    private String deliveryStage; // DISPATCHED, PICKED_UP, ON_THE_WAY, AT_SITE

    @Column(name = "pickup_from", length = 255)
    private String pickupFrom;

    @Column(length = 500)
    private String note;

    @Column(name = "photo_url", length = 500)
    private String photoUrl;

    @Column(name = "updated_by_name", length = 150)
    private String updatedByName;

    @Column(name = "done_at")
    private LocalDateTime doneAt;
}

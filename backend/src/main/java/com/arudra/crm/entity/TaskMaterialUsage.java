package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Material an employee reports as consumed while executing a task; drives inventory deduction. */
@Getter
@Setter
@Entity
@Table(name = "task_material_usage")
public class TaskMaterialUsage extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id", nullable = false)
    private Task task;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "quantity_used", nullable = false, precision = 15, scale = 2)
    private BigDecimal quantityUsed;

    @Column(length = 50)
    private String unit;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "used_by_id", nullable = false)
    private User usedBy;

    @Column(name = "used_at")
    private LocalDateTime usedAt = LocalDateTime.now();

    @Column(columnDefinition = "TEXT")
    private String remarks;
}

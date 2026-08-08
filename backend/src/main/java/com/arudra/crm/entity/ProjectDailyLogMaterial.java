package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Materials used line within a ProjectDailyLog entry. */
@Getter
@Setter
@Entity
@Table(name = "project_daily_log_materials")
public class ProjectDailyLogMaterial extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "daily_log_id", nullable = false)
    private ProjectDailyLog dailyLog;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Product product;

    @Column(name = "quantity_used", precision = 15, scale = 2)
    private BigDecimal quantityUsed;
}

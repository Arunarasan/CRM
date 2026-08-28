package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Website client testimonial. Admin-managed. */
@Entity
@Table(name = "testimonials")
@Getter
@Setter
public class Testimonial extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 100)
    private String role;

    @Column(length = 100)
    private String location;

    @Column(nullable = false)
    private Integer rating = 5;

    @Column(columnDefinition = "TEXT")
    private String quote;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0;
}

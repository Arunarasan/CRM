package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "contact_persons")
public class ContactPerson extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private Customer customer;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 100)
    private String designation;

    @Column(length = 20)
    private String phone;

    @Column(length = 100)
    private String email;

    @Column(name = "is_primary")
    private Boolean isPrimary = false;

    @Column(length = 20)
    private String whatsapp;

    @Column(columnDefinition = "TEXT")
    private String notes;
}

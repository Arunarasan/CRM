package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "permissions")
public class Permission extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String name; // e.g., CUSTOMER_READ, CUSTOMER_WRITE, PROJECT_CREATE
}

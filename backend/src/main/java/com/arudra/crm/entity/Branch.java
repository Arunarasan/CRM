package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * An office / branch of the company. Employees, attendance locations and attendance devices are
 * assigned to a branch so attendance can be filtered and a terminal can only record for its branch.
 */
@Getter
@Setter
@Entity
@Table(name = "branches")
public class Branch extends BaseEntity {

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 30, unique = true)
    private String code;

    @Column(length = 500)
    private String address;

    @Column(length = 100)
    private String city;

    @Column(length = 30)
    private String phone;

    @Column(nullable = false)
    private Boolean active = true;
}

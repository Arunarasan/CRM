package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "warehouses")
public class Warehouse extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 255)
    private String location;

    @Column(name = "manager_name", length = 100)
    private String managerName;
}

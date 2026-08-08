package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@Entity
@Table(name = "tags")
public class Tag extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String name;

    @Column(length = 20)
    private String color; // e.g., "#FF0000" or "blue"

    @ManyToMany(mappedBy = "tags", fetch = FetchType.LAZY)
    private Set<Customer> customers = new HashSet<>();
}

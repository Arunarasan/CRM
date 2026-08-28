package com.arudra.crm.entity;

import com.arudra.crm.util.StringListConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Website material/finish (wood, marble, laminate…). Admin-managed, read-only to the public. */
@Entity
@Table(name = "materials")
@Getter
@Setter
public class Material extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 220, unique = true)
    private String slug;

    @Column(length = 100)
    private String category;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String finish;

    @Column(length = 100)
    private String color;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<String> applications;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0;
}

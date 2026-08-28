package com.arudra.crm.entity;

import com.arudra.crm.util.StringListConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Website service offering (Interior Design, Modular Kitchen…). Admin-managed. */
@Entity
@Table(name = "services")
@Getter
@Setter
public class Service extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 220, unique = true)
    private String slug;

    @Column(name = "short_description", length = 500)
    private String shortDescription;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(length = 50)
    private String icon;

    @Column(columnDefinition = "TEXT")
    private String overview;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<String> benefits;

    @Convert(converter = StringListConverter.class)
    @Column(name = "materials_list", columnDefinition = "TEXT")
    private List<String> materialsList;

    /** JSON array of {title,description} process steps. */
    @Column(name = "process_json", columnDefinition = "TEXT")
    private String processJson;

    /** JSON array of {question,answer} FAQ items. */
    @Column(name = "faq_json", columnDefinition = "TEXT")
    private String faqJson;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0;
}

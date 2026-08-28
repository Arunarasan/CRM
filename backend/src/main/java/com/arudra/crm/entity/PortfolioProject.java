package com.arudra.crm.entity;

import com.arudra.crm.util.StringListConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

/** Website portfolio case study. Admin-managed showcase, distinct from CRM Project. */
@Entity
@Table(name = "portfolio_projects")
@Getter
@Setter
public class PortfolioProject extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 220, unique = true)
    private String slug;

    @Column(length = 100)
    private String category;

    @Column(length = 150)
    private String location;

    private Integer year;

    @Column(name = "cover_image", length = 500)
    private String coverImage;

    @Column(columnDefinition = "TEXT")
    private String concept;

    @Convert(converter = StringListConverter.class)
    @Column(name = "materials_list", columnDefinition = "TEXT")
    private List<String> materialsList;

    @Convert(converter = StringListConverter.class)
    @Column(name = "services_list", columnDefinition = "TEXT")
    private List<String> servicesList;

    @Convert(converter = StringListConverter.class)
    @Column(columnDefinition = "TEXT")
    private List<String> highlights;

    /** JSON array of gallery image URLs. */
    @Column(name = "gallery_json", columnDefinition = "TEXT")
    private String galleryJson;

    /** JSON object {quote,name,role} for the client testimonial. */
    @Column(name = "testimonial_json", columnDefinition = "TEXT")
    private String testimonialJson;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0;
}

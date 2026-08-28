package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Homepage hero carousel slide. Admin-managed. */
@Entity
@Table(name = "hero_slides")
@Getter
@Setter
public class HeroSlide extends BaseEntity {

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(length = 200)
    private String eyebrow;

    @Column(length = 200)
    private String title;

    @Column(name = "title_accent", length = 100)
    private String titleAccent;

    @Column(length = 500)
    private String description;

    @Column(name = "primary_button_text", length = 100)
    private String primaryButtonText;

    @Column(name = "primary_button_link", length = 200)
    private String primaryButtonLink;

    @Column(name = "secondary_button_text", length = 100)
    private String secondaryButtonText;

    @Column(name = "secondary_button_link", length = 200)
    private String secondaryButtonLink;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(nullable = false)
    private Boolean active = true;
}

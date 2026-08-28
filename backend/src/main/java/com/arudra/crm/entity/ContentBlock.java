package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * A CMS-managed chunk of page copy, addressed by (page, section_key) — e.g.
 * page "home", section "why_choose_us". The public site fetches all blocks for a page and renders
 * them over its compiled-in defaults; the CRM edits title/subtitle/body and can hide a block.
 */
@Entity
@Table(name = "content_blocks")
@Getter
@Setter
public class ContentBlock extends BaseEntity {

    /** Which page this belongs to: home | about | contact | ... */
    @Column(nullable = false, length = 60)
    private String page;

    /** Stable section identifier within the page, e.g. "hero", "why_choose_us", "intro". */
    @Column(name = "section_key", nullable = false, length = 80)
    private String sectionKey;

    @Column(length = 250)
    private String title;

    @Column(length = 500)
    private String subtitle;

    @Column(columnDefinition = "TEXT")
    private String body;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder = 0;

    @Column(nullable = false)
    private Boolean active = true;
}

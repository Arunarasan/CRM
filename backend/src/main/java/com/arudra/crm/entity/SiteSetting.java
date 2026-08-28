package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * A single CMS-managed site setting (key/value), e.g. brand name, contact phone, a social URL.
 * Grouped + labelled so the CRM can render a friendly settings form; the public site reads them as a
 * flat key→value map that overlays its compiled-in defaults.
 */
@Entity
@Table(name = "site_settings")
@Getter
@Setter
public class SiteSetting extends BaseEntity {

    @Column(name = "setting_key", nullable = false, length = 100, unique = true)
    private String settingKey;

    @Column(name = "setting_value", columnDefinition = "TEXT")
    private String settingValue;

    /** UI grouping for the CRM form, e.g. "Brand", "Contact", "Social". */
    @Column(name = "group_name", length = 60)
    private String groupName;

    /** Human label shown in the CRM form. */
    @Column(length = 150)
    private String label;

    /** text | textarea | url | tel | email — hints the CRM input type. */
    @Column(name = "input_type", nullable = false, length = 30)
    private String inputType = "text";

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder = 0;
}

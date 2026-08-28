package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Admin-managed master list of standard measurement items. An employee capturing a site measurement
 * picks from this catalog instead of free-typing, so item name / category / unit / material stay
 * consistent across measurements — and therefore across the BOQ generated from them. Employees may
 * still add a one-off "Other" item; only admins manage the catalog itself.
 */
@Entity
@Table(name = "measurement_item_catalog")
@Getter
@Setter
public class MeasurementItemCatalog extends BaseEntity {

    /** Display name, e.g. "Wall Painting". */
    @Column(nullable = false, length = 200)
    private String name;

    /** Category / measurement item type, e.g. "Wall", "Floor". Maps to MeasurementItem.itemType. */
    @Column(name = "item_type", length = 50)
    private String itemType;

    /** Default unit (sqft / rft / nos). */
    @Column(name = "default_unit", length = 20)
    private String defaultUnit;

    /** Default material carried onto the captured item (optional). */
    @Column(name = "default_material", length = 100)
    private String defaultMaterial;

    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "order_index")
    private Integer orderIndex = 0;
}

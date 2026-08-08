package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** Delivery/damage photo attached to a goods receipt note (uploaded via /api/uploads). */
@Getter
@Setter
@Entity
@Table(name = "grn_photos")
public class GrnPhoto extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "grn_id", nullable = false)
    private GoodsReceiptNote grn;

    @Column(name = "photo_url", nullable = false, length = 500)
    private String photoUrl;

    @Column(length = 255)
    private String caption;
}

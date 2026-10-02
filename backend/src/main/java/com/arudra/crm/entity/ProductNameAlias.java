package com.arudra.crm.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/** A quote-line name someone linked to a product by hand; the quote auto-linker matches it from then on. */
@Getter
@Setter
@Entity
@Table(name = "product_name_aliases")
public class ProductNameAlias extends BaseEntity {

    /** Normalised name (lower-case, single-spaced alphanumerics). */
    @Column(nullable = false, unique = true)
    private String alias;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Product product;
}

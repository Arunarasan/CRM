package com.arudra.crm.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

/**
 * Links a login {@link User} to a {@link Customer} record. A user may be linked to more than one
 * customer (multi-user-per-company), each with a portal role. {@link com.arudra.crm.security.CustomerAccessService}
 * resolves the set of customer ids a signed-in user may access, which every portal query filters by.
 */
@Entity
@Table(name = "customer_user")
@Getter
@Setter
public class CustomerUser extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id")
    private Customer customer;

    /** OWNER | MEMBER */
    @Column(name = "portal_role", nullable = false, length = 20)
    private String portalRole = "OWNER";

    @Column(name = "is_primary", nullable = false)
    private Boolean primary = true;

    /** When true, this link is suspended — the client keeps their login but is denied portal access. */
    @Column(nullable = false)
    private Boolean suspended = false;
}

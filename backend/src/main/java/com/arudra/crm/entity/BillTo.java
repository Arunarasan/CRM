package com.arudra.crm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.Getter;
import lombok.Setter;

/** The customer's company details as printed on one quotation / invoice (editable per document). */
@Getter
@Setter
@Embeddable
public class BillTo {

    @Column(name = "bill_to_name", length = 200)
    private String name;

    @Column(name = "bill_to_gstin", length = 20)
    private String gstin;

    @Column(name = "bill_to_address", columnDefinition = "TEXT")
    private String address;

    @Column(name = "bill_to_state", length = 100)
    private String state;

    @Column(name = "bill_to_phone", length = 30)
    private String phone;

    @Column(name = "bill_to_email", length = 150)
    private String email;

    public BillTo copy() {
        BillTo b = new BillTo();
        b.name = name; b.gstin = gstin; b.address = address; b.state = state; b.phone = phone; b.email = email;
        return b;
    }

    /** Trim blanks to null and upper-case the GSTIN. */
    public void normalise() {
        name = blank(name); address = blank(address); state = blank(state); phone = blank(phone); email = blank(email);
        gstin = blank(gstin);
        if (gstin != null) gstin = gstin.toUpperCase();
    }

    private static String blank(String s) { return s == null || s.trim().isEmpty() ? null : s.trim(); }
}

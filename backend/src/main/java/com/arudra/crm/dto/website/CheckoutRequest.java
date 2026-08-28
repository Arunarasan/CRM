package com.arudra.crm.dto.website;

import java.util.List;

/**
 * A guest checkout submitted from the public website shop. The website cart is anonymous
 * (client-side), so the order carries the buyer's contact + delivery details; the backend
 * finds-or-creates a {@link com.arudra.crm.entity.Customer} from the email so every order still
 * lands against a CRM customer record. Prices are NEVER taken from this payload — they are
 * re-resolved server-side from {@code shop_products}.
 */
public record CheckoutRequest(
        String name,
        String phone,
        String email,
        String address,
        String city,
        String pincode,
        String paymentMethod,
        String notes,
        List<Item> items) {

    /** A single line: which product and how many. Price is resolved server-side. */
    public record Item(Long productId, Integer qty) {}
}

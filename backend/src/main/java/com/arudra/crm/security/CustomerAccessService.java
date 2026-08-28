package com.arudra.crm.security;

import com.arudra.crm.entity.Customer;
import com.arudra.crm.entity.CustomerUser;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.CustomerUserRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Resolves which {@link Customer} records the signed-in {@link User} may access, and enforces
 * ownership. THIS is the real gate for the customer portal — every portal query filters by
 * {@link #accessibleCustomerIds}, and any endpoint taking a resource id calls {@link #assertAccess}
 * so a customer can never read another customer's project/quotation/invoice/etc. by changing an id.
 */
@Service
public class CustomerAccessService {

    private final CustomerUserRepository customerUserRepository;

    public CustomerAccessService(CustomerUserRepository customerUserRepository) {
        this.customerUserRepository = customerUserRepository;
    }

    private List<CustomerUser> links(User user) {
        if (user == null) return List.of();
        // Suspended links are excluded everywhere — a suspended client keeps their login but can
        // access nothing until an admin re-enables them.
        return customerUserRepository.findByUser_IdAndIsDeletedFalse(user.getId()).stream()
                .filter(cu -> !Boolean.TRUE.equals(cu.getSuspended()))
                .collect(Collectors.toList());
    }

    /** All customer ids this user may access (usually one; more for multi-user companies). */
    public List<Long> accessibleCustomerIds(User user) {
        return links(user).stream()
                .map(cu -> cu.getCustomer().getId())
                .collect(Collectors.toList());
    }

    /** The user's primary Customer (the one shown by default in the portal). */
    public Customer primaryCustomer(User user) {
        List<CustomerUser> links = links(user);
        if (links.isEmpty()) {
            throw new AccessDeniedException("No customer account is linked to this login.");
        }
        return links.stream()
                .filter(cu -> Boolean.TRUE.equals(cu.getPrimary()))
                .findFirst()
                .orElse(links.get(0))
                .getCustomer();
    }

    /** True if the user may access the given customer id. */
    public boolean canAccess(User user, Long customerId) {
        return customerId != null && accessibleCustomerIds(user).contains(customerId);
    }

    /** Throws {@link AccessDeniedException} unless the user may access the given customer id. */
    public void assertAccess(User user, Long customerId) {
        if (!canAccess(user, customerId)) {
            throw new AccessDeniedException("You do not have access to this resource.");
        }
    }
}

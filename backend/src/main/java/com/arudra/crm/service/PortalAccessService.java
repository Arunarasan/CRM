package com.arudra.crm.service;

import com.arudra.crm.entity.Customer;
import com.arudra.crm.entity.CustomerUser;
import com.arudra.crm.entity.Role;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.CustomerRepository;
import com.arudra.crm.repository.CustomerUserRepository;
import com.arudra.crm.repository.RoleRepository;
import com.arudra.crm.repository.UserRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Admin management of a customer's portal login(s). Lets staff see whether a customer can sign in to
 * the portal, grant access (creating or linking a ROLE_CUSTOMER login) so the client sees their
 * projects/orders, and revoke it. Portal data is scoped by the customer_user link, so granting access
 * to a customer immediately exposes that customer's projects/quotations/invoices/orders in the portal.
 */
@Service
public class PortalAccessService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String PW_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    private final CustomerRepository customerRepository;
    private final CustomerUserRepository customerUserRepository;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final PortalPolicyService portalPolicy;

    public PortalAccessService(CustomerRepository customerRepository, CustomerUserRepository customerUserRepository,
                               UserRepository userRepository, RoleRepository roleRepository,
                               PasswordEncoder passwordEncoder, PortalPolicyService portalPolicy) {
        this.customerRepository = customerRepository;
        this.customerUserRepository = customerUserRepository;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.portalPolicy = portalPolicy;
    }

    /** Current portal-access status for a customer. */
    @Transactional(readOnly = true)
    public Map<String, Object> getAccess(Long customerId) {
        Customer customer = loadCustomer(customerId);
        List<Map<String, Object>> logins = new ArrayList<>();
        for (CustomerUser cu : customerUserRepository.findByCustomer_IdAndIsDeletedFalse(customerId)) {
            User u = cu.getUser();
            if (u == null) continue;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("userId", u.getId());
            m.put("name", u.getName());
            m.put("email", u.getEmail());
            m.put("portalRole", cu.getPortalRole());
            m.put("primary", cu.getPrimary());
            m.put("emailVerified", u.isEmailVerified());
            m.put("suspended", Boolean.TRUE.equals(cu.getSuspended()));
            logins.add(m);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("customerId", customer.getId());
        out.put("customerName", customer.getName());
        out.put("customerEmail", customer.getEmail());
        out.put("hasAccess", !logins.isEmpty());
        out.put("portalGloballyEnabled", portalPolicy.isEnabled());
        out.put("logins", logins);
        return out;
    }

    /** Suspend or re-enable one login's access to this customer's portal. */
    @Transactional
    public void setSuspended(Long customerId, Long userId, boolean suspended) {
        CustomerUser link = customerUserRepository
                .findByUser_IdAndCustomer_IdAndIsDeletedFalse(userId, customerId)
                .orElseThrow(() -> new EntityNotFoundException("No portal link found."));
        link.setSuspended(suspended);
        customerUserRepository.save(link);
    }

    /**
     * Grant portal access. Uses the given email (or the customer's email) as the login. If a user with
     * that email already exists it is linked; otherwise a new verified ROLE_CUSTOMER login is created
     * with a temporary password, which is returned ONCE so the admin can share it.
     */
    @Transactional
    public Map<String, Object> grantAccess(Long customerId, String email) {
        Customer customer = loadCustomer(customerId);
        String loginEmail = (email != null && !email.isBlank()) ? email.trim().toLowerCase()
                : (customer.getEmail() != null ? customer.getEmail().trim().toLowerCase() : null);
        if (loginEmail == null || !loginEmail.contains("@")) {
            throw new IllegalArgumentException("This customer has no email. Add one, or enter a login email.");
        }

        User existing = userRepository.findByEmail(loginEmail).orElse(null);
        String tempPassword = null;
        User user;
        if (existing != null) {
            user = existing;
            ensureCustomerRole(user);
        } else {
            tempPassword = generatePassword();
            user = new User();
            user.setName(customer.getName() != null ? customer.getName() : loginEmail);
            user.setEmail(loginEmail);
            user.setPassword(passwordEncoder.encode(tempPassword));
            Set<Role> roles = new HashSet<>();
            roles.add(customerRole());
            user.setRoles(roles);
            user.setAccountNonLocked(true);
            user.setEmailVerified(true);          // admin-granted → no OTP gate
            user.setMustChangePassword(true);     // client sets their own on first sign-in
            user = userRepository.save(user);
        }

        if (customerUserRepository
                .findByUser_IdAndCustomer_IdAndIsDeletedFalse(user.getId(), customerId).isEmpty()) {
            boolean isPrimary = customerUserRepository.findByCustomer_IdAndIsDeletedFalse(customerId).isEmpty();
            CustomerUser link = new CustomerUser();
            link.setUser(user);
            link.setCustomer(customer);
            link.setPortalRole("OWNER");
            link.setPrimary(isPrimary);
            customerUserRepository.save(link);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("email", loginEmail);
        out.put("linkedExistingAccount", existing != null);
        out.put("temporaryPassword", tempPassword); // null when an existing account was linked
        return out;
    }

    /** Revoke a login's access to this customer (soft-deletes the link; the user account stays). */
    @Transactional
    public void revokeAccess(Long customerId, Long userId) {
        CustomerUser link = customerUserRepository
                .findByUser_IdAndCustomer_IdAndIsDeletedFalse(userId, customerId)
                .orElseThrow(() -> new EntityNotFoundException("No portal access to revoke."));
        link.setIsDeleted(true);
        link.setDeletedAt(LocalDateTime.now());
        customerUserRepository.save(link);
    }

    private void ensureCustomerRole(User user) {
        boolean hasRole = user.getRoles().stream().anyMatch(r -> "ROLE_CUSTOMER".equals(r.getName()));
        if (!hasRole) {
            user.getRoles().add(customerRole());
            userRepository.save(user);
        }
    }

    private Role customerRole() {
        return roleRepository.findByName("ROLE_CUSTOMER")
                .orElseThrow(() -> new IllegalStateException("Customer role is not configured."));
    }

    private Customer loadCustomer(Long id) {
        return customerRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Customer not found: " + id));
    }

    private String generatePassword() {
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) sb.append(PW_ALPHABET.charAt(RANDOM.nextInt(PW_ALPHABET.length())));
        return sb.toString();
    }
}

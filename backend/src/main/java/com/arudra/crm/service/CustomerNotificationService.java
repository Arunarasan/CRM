package com.arudra.crm.service;

import com.arudra.crm.entity.Customer;
import com.arudra.crm.entity.CustomerNotification;
import com.arudra.crm.repository.CustomerNotificationRepository;
import org.springframework.stereotype.Service;

/**
 * Creates customer-facing notifications (the portal notification feed). Called whenever something
 * happens a customer should know about — a service request is received/updated, a quotation is
 * ready, a payment is recorded, a project is completed. Kept deliberately simple and side-effect
 * free beyond the insert, so callers can fire-and-forget.
 */
@Service
public class CustomerNotificationService {

    private final CustomerNotificationRepository repository;

    public CustomerNotificationService(CustomerNotificationRepository repository) {
        this.repository = repository;
    }

    public CustomerNotification notify(Customer customer, String type, String title, String body, String link) {
        CustomerNotification n = new CustomerNotification();
        n.setCustomer(customer);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setLink(link);
        return repository.save(n);
    }
}

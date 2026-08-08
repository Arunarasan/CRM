package com.arudra.crm.repository;

import com.arudra.crm.entity.Customer;
import org.springframework.data.jpa.domain.Specification;
import jakarta.persistence.criteria.Join;

public class CustomerSpecification {

    public static Specification<Customer> hasName(String name) {
        return (root, query, cb) -> name == null ? null : cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%");
    }

    public static Specification<Customer> hasCity(String city) {
        return (root, query, cb) -> city == null ? null : cb.like(cb.lower(root.get("city")), "%" + city.toLowerCase() + "%");
    }
    
    public static Specification<Customer> hasEmail(String email) {
        return (root, query, cb) -> email == null ? null : cb.like(cb.lower(root.get("email")), "%" + email.toLowerCase() + "%");
    }
    
    public static Specification<Customer> hasPhone(String phone) {
        return (root, query, cb) -> phone == null ? null : cb.like(root.get("phone"), "%" + phone + "%");
    }

    public static Specification<Customer> hasTag(String tagName) {
        return (root, query, cb) -> {
            if (tagName == null || tagName.isEmpty()) return null;
            Join<Object, Object> tags = root.join("tags");
            return cb.equal(cb.lower(tags.get("name")), tagName.toLowerCase());
        };
    }
}

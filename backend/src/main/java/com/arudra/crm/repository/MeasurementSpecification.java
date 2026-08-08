package com.arudra.crm.repository;

import com.arudra.crm.entity.Measurement;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** Dynamic filters for the measurement list, mirroring LeadSpecification. */
public class MeasurementSpecification {

    public static Specification<Measurement> notDeleted() {
        return (root, query, cb) -> cb.equal(root.get("isDeleted"), false);
    }

    public static Specification<Measurement> hasStatus(String status) {
        return (root, query, cb) -> {
            if (status == null || status.isEmpty()) return null;
            return cb.equal(root.get("status"), status);
        };
    }

    public static Specification<Measurement> hasType(String type) {
        return (root, query, cb) -> {
            if (type == null || type.isEmpty()) return null;
            return cb.equal(root.get("measurementType"), type);
        };
    }

    public static Specification<Measurement> hasPriority(String priority) {
        return (root, query, cb) -> {
            if (priority == null || priority.isEmpty()) return null;
            return cb.equal(root.get("priority"), priority);
        };
    }

    public static Specification<Measurement> hasCustomer(Long customerId) {
        return (root, query, cb) -> {
            if (customerId == null) return null;
            return cb.equal(root.get("customer").get("id"), customerId);
        };
    }

    public static Specification<Measurement> hasProject(Long projectId) {
        return (root, query, cb) -> {
            if (projectId == null) return null;
            return cb.equal(root.get("project").get("id"), projectId);
        };
    }

    public static Specification<Measurement> hasLead(Long leadId) {
        return (root, query, cb) -> {
            if (leadId == null) return null;
            return cb.equal(root.get("lead").get("id"), leadId);
        };
    }

    public static Specification<Measurement> hasEngineer(Long engineerId) {
        return (root, query, cb) -> {
            if (engineerId == null) return null;
            return cb.equal(root.get("assignedEngineer").get("id"), engineerId);
        };
    }

    public static Specification<Measurement> latestRevisionOnly(Boolean latestOnly) {
        return (root, query, cb) -> {
            if (!Boolean.TRUE.equals(latestOnly)) return null;
            return cb.equal(root.get("isLatestRevision"), true);
        };
    }

    public static Specification<Measurement> dateBetween(LocalDate from, LocalDate to) {
        return (root, query, cb) -> {
            if (from == null && to == null) return null;
            if (from != null && to != null) return cb.between(root.get("measurementDate"), from, to);
            if (from != null) return cb.greaterThanOrEqualTo(root.get("measurementDate"), from);
            return cb.lessThanOrEqualTo(root.get("measurementDate"), to);
        };
    }

    /** Free-text search across number, customer, project, engineer name and site address. */
    public static Specification<Measurement> matchesSearch(String search) {
        return (root, query, cb) -> {
            if (search == null || search.isBlank()) return null;
            String like = "%" + search.toLowerCase() + "%";
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.like(cb.lower(root.get("measurementNumber")), like));
            predicates.add(cb.like(cb.lower(root.get("siteAddress")), like));
            predicates.add(cb.like(cb.lower(root.get("measuredBy")), like));
            predicates.add(cb.like(cb.lower(root.join("customer", JoinType.LEFT).get("name")), like));
            predicates.add(cb.like(cb.lower(root.join("project", JoinType.LEFT).get("projectName")), like));
            predicates.add(cb.like(cb.lower(root.join("assignedEngineer", JoinType.LEFT).get("name")), like));
            return cb.or(predicates.toArray(new Predicate[0]));
        };
    }
}

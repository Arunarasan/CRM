package com.arudra.crm.repository;

import com.arudra.crm.entity.Boq;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

/** Dynamic filters for the BOQ list, mirroring MeasurementSpecification. */
public class BoqSpecification {

    public static Specification<Boq> notDeleted() {
        return (root, query, cb) -> cb.equal(root.get("isDeleted"), false);
    }

    public static Specification<Boq> hasStatus(String status) {
        return (root, query, cb) -> {
            if (status == null || status.isEmpty()) return null;
            return cb.equal(root.get("status"), status);
        };
    }

    public static Specification<Boq> hasCustomer(Long customerId) {
        return (root, query, cb) -> {
            if (customerId == null) return null;
            return cb.equal(root.get("customer").get("id"), customerId);
        };
    }

    public static Specification<Boq> hasProject(Long projectId) {
        return (root, query, cb) -> {
            if (projectId == null) return null;
            return cb.equal(root.get("project").get("id"), projectId);
        };
    }

    public static Specification<Boq> latestVersionOnly(Boolean latestOnly) {
        return (root, query, cb) -> {
            if (!Boolean.TRUE.equals(latestOnly)) return null;
            return cb.equal(root.get("isLatestVersion"), true);
        };
    }

    /** Free-text search across BOQ number, customer name and project name. */
    public static Specification<Boq> matchesSearch(String search) {
        return (root, query, cb) -> {
            if (search == null || search.isBlank()) return null;
            String like = "%" + search.toLowerCase() + "%";
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.like(cb.lower(root.get("boqNumber")), like));
            predicates.add(cb.like(cb.lower(root.join("customer", JoinType.LEFT).get("name")), like));
            predicates.add(cb.like(cb.lower(root.join("project", JoinType.LEFT).get("projectName")), like));
            return cb.or(predicates.toArray(new Predicate[0]));
        };
    }
}

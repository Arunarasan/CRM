package com.arudra.crm.repository;

import com.arudra.crm.entity.SiteVisit;
import com.arudra.crm.entity.SiteVisitAssignment;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class SiteVisitSpecification {

    public static Specification<SiteVisit> notDeleted() {
        return (root, query, cb) -> cb.equal(root.get("isDeleted"), false);
    }

    public static Specification<SiteVisit> hasStatus(String status) {
        return (root, query, cb) -> {
            if (status == null || status.isEmpty()) return null;
            return cb.equal(root.get("status"), status);
        };
    }

    public static Specification<SiteVisit> hasVisitType(String visitType) {
        return (root, query, cb) -> {
            if (visitType == null || visitType.isEmpty()) return null;
            return cb.equal(root.get("visitType"), visitType);
        };
    }

    public static Specification<SiteVisit> hasPriority(String priority) {
        return (root, query, cb) -> {
            if (priority == null || priority.isEmpty()) return null;
            return cb.equal(root.get("priority"), priority);
        };
    }

    public static Specification<SiteVisit> hasProject(Long projectId) {
        return (root, query, cb) -> {
            if (projectId == null) return null;
            return cb.equal(root.get("project").get("id"), projectId);
        };
    }

    public static Specification<SiteVisit> hasCustomer(Long customerId) {
        return (root, query, cb) -> {
            if (customerId == null) return null;
            return cb.equal(root.get("customer").get("id"), customerId);
        };
    }

    public static Specification<SiteVisit> assignedToEmployee(Long employeeId) {
        return (root, query, cb) -> {
            if (employeeId == null) return null;
            Subquery<Long> sub = query.subquery(Long.class);
            var assignmentRoot = sub.from(SiteVisitAssignment.class);
            sub.select(assignmentRoot.get("siteVisit").get("id"))
                    .where(cb.equal(assignmentRoot.get("assignedUser").get("id"), employeeId));
            return root.get("id").in(sub);
        };
    }

    public static Specification<SiteVisit> isBetweenDates(LocalDateTime start, LocalDateTime end) {
        return (root, query, cb) -> {
            if (start == null || end == null) return null;
            return cb.between(root.get("scheduledTime"), start, end);
        };
    }

    public static Specification<SiteVisit> scheduledDateBetween(LocalDate start, LocalDate end) {
        return (root, query, cb) -> {
            if (start == null || end == null) return null;
            return cb.between(root.get("scheduledDate"), start, end);
        };
    }
}

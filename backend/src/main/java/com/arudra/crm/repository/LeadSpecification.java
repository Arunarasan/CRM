package com.arudra.crm.repository;

import com.arudra.crm.entity.Lead;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class LeadSpecification {

    public static Specification<Lead> notDeleted() {
        return (root, query, criteriaBuilder) -> criteriaBuilder.equal(root.get("isDeleted"), false);
    }

    public static Specification<Lead> hasStatus(String status) {
        return (root, query, criteriaBuilder) -> {
            if (status == null || status.isEmpty()) return null;
            return criteriaBuilder.equal(root.get("status"), status);
        };
    }

    public static Specification<Lead> hasStage(String stage) {
        return (root, query, criteriaBuilder) -> {
            if (stage == null || stage.isEmpty()) return null;
            return criteriaBuilder.equal(root.get("stage"), stage);
        };
    }

    public static Specification<Lead> hasSource(String source) {
        return (root, query, criteriaBuilder) -> {
            if (source == null || source.isEmpty()) return null;
            return criteriaBuilder.equal(root.get("leadSource"), source);
        };
    }

    public static Specification<Lead> hasType(String leadType) {
        return (root, query, criteriaBuilder) -> {
            if (leadType == null || leadType.isEmpty()) return null;
            return criteriaBuilder.equal(root.get("leadType"), leadType);
        };
    }

    public static Specification<Lead> hasPriority(String priority) {
        return (root, query, criteriaBuilder) -> {
            if (priority == null || priority.isEmpty()) return null;
            return criteriaBuilder.equal(root.get("priority"), priority);
        };
    }

    public static Specification<Lead> hasTemperature(String temperature) {
        return (root, query, criteriaBuilder) -> {
            if (temperature == null || temperature.isEmpty()) return null;
            return criteriaBuilder.equal(root.get("leadTemperature"), temperature);
        };
    }

    public static Specification<Lead> hasCity(String city) {
        return (root, query, criteriaBuilder) -> {
            if (city == null || city.isEmpty()) return null;
            return criteriaBuilder.equal(criteriaBuilder.lower(root.get("city")), city.toLowerCase());
        };
    }

    public static Specification<Lead> hasAssignedEmployee(Long employeeId) {
        return (root, query, criteriaBuilder) -> {
            if (employeeId == null) return null;
            return criteriaBuilder.equal(root.get("assignedSalesExecutive").get("id"), employeeId);
        };
    }

    public static Specification<Lead> isConverted(Boolean converted) {
        return (root, query, criteriaBuilder) -> {
            if (converted == null) return null;
            return criteriaBuilder.equal(root.get("isConverted"), converted);
        };
    }

    public static Specification<Lead> budgetBetween(BigDecimal min, BigDecimal max) {
        return (root, query, criteriaBuilder) -> {
            if (min == null && max == null) return null;
            List<Predicate> predicates = new ArrayList<>();
            if (min != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("estimatedBudget"), min));
            }
            if (max != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("estimatedBudget"), max));
            }
            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    public static Specification<Lead> createdBetween(LocalDate from, LocalDate to) {
        return (root, query, criteriaBuilder) -> {
            if (from == null && to == null) return null;
            List<Predicate> predicates = new ArrayList<>();
            if (from != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("createdAt"), from.atStartOfDay()));
            }
            if (to != null) {
                predicates.add(criteriaBuilder.lessThan(root.get("createdAt"), to.plusDays(1).atStartOfDay()));
            }
            return criteriaBuilder.and(predicates.toArray(new Predicate[0]));
        };
    }

    /**
     * Free-text search across lead number, customer identity, all phone numbers,
     * email, company, city and project/site address.
     */
    public static Specification<Lead> matchesSearch(String search) {
        return (root, query, criteriaBuilder) -> {
            if (search == null || search.isEmpty()) return null;
            String like = "%" + search.toLowerCase() + "%";
            return criteriaBuilder.or(
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("leadNumber")), like),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("name")), like),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("contactPerson")), like),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("companyName")), like),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("email")), like),
                    criteriaBuilder.like(root.get("mobileNumber"), like),
                    criteriaBuilder.like(root.get("alternateMobile"), like),
                    criteriaBuilder.like(root.get("whatsappNumber"), like),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("city")), like),
                    criteriaBuilder.like(criteriaBuilder.lower(root.get("siteAddress")), like));
        };
    }
}

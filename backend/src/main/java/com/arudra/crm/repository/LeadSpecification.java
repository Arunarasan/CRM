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

    /** Open leads whose next follow-up is overdue — mirrors the dashboard's "pending follow-ups". */
    public static Specification<Lead> followUpDue(Boolean due) {
        return (root, query, criteriaBuilder) -> {
            if (!Boolean.TRUE.equals(due)) return null;
            return criteriaBuilder.and(
                    criteriaBuilder.isNotNull(root.get("nextFollowUpDate")),
                    criteriaBuilder.lessThan(root.get("nextFollowUpDate"), LocalDate.now()),
                    criteriaBuilder.isFalse(root.get("isConverted")),
                    criteriaBuilder.not(root.get("status").in(com.arudra.crm.util.LeadWorkflow.CLOSED_STATUSES))
            );
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
     * Enquiry tag (PRODUCT / SERVICE / OTHER). Mirrors the frontend's enquiryTypeOf(): an untagged
     * legacy lead counts as SERVICE/OTHER when it carries that detail, else PRODUCT when it has a
     * category or product.
     */
    public static Specification<Lead> hasEnquiryType(String type) {
        return (root, query, cb) -> {
            if (type == null || type.isEmpty()) return null;
            Predicate tagged = cb.equal(root.get("enquiryType"), type);
            Predicate untagged = cb.or(cb.isNull(root.get("enquiryType")), cb.equal(root.get("enquiryType"), ""));
            Predicate hasService = blankNot(cb, root.get("requirementService"));
            Predicate hasOther = blankNot(cb, root.get("requirementOther"));
            Predicate inferred = switch (type) {
                case "SERVICE" -> hasService;
                case "OTHER" -> cb.and(cb.not(hasService), hasOther);
                case "PRODUCT" -> cb.and(cb.not(hasService), cb.not(hasOther),
                        cb.or(blankNot(cb, root.get("requirementCategory")), blankNot(cb, root.get("requirementProduct"))));
                default -> cb.disjunction();
            };
            return cb.or(tagged, cb.and(untagged, inferred));
        };
    }

    public static Specification<Lead> hasCategory(String category) {
        return (root, query, cb) -> {
            if (category == null || category.isEmpty()) return null;
            return cb.equal(cb.lower(root.get("requirementCategory")), category.toLowerCase());
        };
    }

    /** Category is one of the given names (case-insensitive). */
    public static Specification<Lead> categoryIn(List<String> names) {
        return (root, query, cb) -> {
            if (names == null || names.isEmpty()) return null;
            return cb.lower(root.get("requirementCategory")).in(names.stream().map(String::toLowerCase).toList());
        };
    }

    /** Category is blank or none of the given names — the "Others" bucket. */
    public static Specification<Lead> categoryNotIn(List<String> names) {
        return (root, query, cb) -> {
            if (names == null || names.isEmpty()) return null;
            return cb.or(cb.isNull(root.get("requirementCategory")),
                    cb.not(cb.lower(root.get("requirementCategory")).in(names.stream().map(String::toLowerCase).toList())));
        };
    }

    /** Exact match of one entry inside a comma-separated list column ("A, B, C"). */
    public static Specification<Lead> listContains(String field, String value) {
        return (root, query, cb) -> {
            if (value == null || value.isBlank()) return null;
            jakarta.persistence.criteria.Expression<String> normalized =
                    cb.concat(cb.concat(",", cb.function("REPLACE", String.class,
                            cb.lower(root.get(field)), cb.literal(", "), cb.literal(","))), ",");
            return cb.like(normalized, "%," + value.trim().toLowerCase() + ",%");
        };
    }

    private static Predicate blankNot(jakarta.persistence.criteria.CriteriaBuilder cb,
                                      jakarta.persistence.criteria.Path<String> path) {
        return cb.and(cb.isNotNull(path), cb.notEqual(path, ""));
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

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

    // ---------------------------------------------------------------- lead journey stage
    // Every lead sits in exactly one stage, worked out only from real records (never set by hand,
    // except marking a lead Lost). First match wins: Lost > Project > Completed > Quote > Collected > New.
    public static final String STAGE_REQUIREMENT = "REQUIREMENT";     // New: nothing collected yet
    public static final String STAGE_COLLECTED = "COLLECTED";         // any requirement info captured, no quotation
    public static final String STAGE_QUOTE = "QUOTE";                 // a quotation exists, no project yet
    public static final String STAGE_PROJECT = "PROJECT";             // a live project exists
    public static final String STAGE_COMPLETED = "COMPLETED";         // its project was completed (Complete / Handover)
    public static final String STAGE_LOST = "LOST";                   // marked Lost, or its project was cancelled
    public static final List<String> JOURNEY_STAGES = List.of(
            STAGE_REQUIREMENT, STAGE_COLLECTED, STAGE_QUOTE, STAGE_PROJECT, STAGE_COMPLETED, STAGE_LOST);

    private static final List<String> APPROVED_QUOTE_STATUSES = List.of("APPROVED", "CONVERTED");
    private static final List<String> ENDED_PROJECT_STATUSES = List.of("COMPLETED", "CANCELLED");
    private static final String COLLECT_REQUIREMENT_CODE = "TT_COLLECT_REQUIREMENT";

    /** The lead has an approved (or converted) quotation — the "Approved – convert to project" badge. */
    public static Specification<Lead> hasApprovedQuote() {
        return (root, query, cb) -> {
            var sq = query.subquery(Long.class);
            var q = sq.from(com.arudra.crm.entity.Quotation.class);
            sq.select(q.get("id")).where(cb.equal(q.get("lead"), root), q.get("status").in(APPROVED_QUOTE_STATUSES));
            return cb.exists(sq);
        };
    }

    public static Specification<Lead> idIn(java.util.Collection<Long> ids) {
        return (root, query, cb) -> root.get("id").in(ids);
    }

    public static Specification<Lead> journeyStage(String stage) {
        return (root, query, cb) -> {
            if (stage == null || stage.isEmpty()) return null;
            // Several stages at once, comma-joined ("PROJECT,COMPLETED").
            if (stage.contains(",")) {
                return cb.or(java.util.Arrays.stream(stage.split(",")).map(String::trim).filter(x -> !x.isEmpty())
                        .map(x -> journeyStage(x).toPredicate(root, query, cb))
                        .filter(java.util.Objects::nonNull).toArray(Predicate[]::new));
            }
            // NULL-safe throughout: a NULL inside NOT(...) would drop the lead from every stage.
            // Each use builds a fresh predicate — Hibernate's cb.not() can negate a predicate in place,
            // so a predicate object must never be shared between two spots in the tree.
            java.util.function.Function<String, Predicate> project = status -> {
                var sq = query.subquery(Long.class);
                var p = sq.from(com.arudra.crm.entity.Project.class);
                jakarta.persistence.criteria.Expression<String> st = cb.upper(cb.coalesce(p.<String>get("status"), ""));
                Predicate match = status == null ? cb.not(st.in(ENDED_PROJECT_STATUSES)) : cb.equal(st, status);
                sq.select(p.get("id")).where(cb.equal(p.get("lead"), root), notDeletedRow(cb, p), match);
                return cb.exists(sq);
            };
            java.util.function.Supplier<Predicate> live = () -> project.apply(null);
            java.util.function.Supplier<Predicate> completed = () -> project.apply("COMPLETED");
            // Lost: marked Lost, or its project was cancelled and nothing else is live/finished.
            java.util.function.Supplier<Predicate> lost = () -> cb.or(
                    cb.equal(cb.lower(cb.coalesce(root.<String>get("status"), "")), "lost"),
                    cb.and(project.apply("CANCELLED"), cb.not(live.get()), cb.not(completed.get())));

            // Quote building: a quotation exists (a BOQ alone doesn't count — it's created while measuring).
            java.util.function.Supplier<Predicate> quoted = () -> {
                var sq = query.subquery(Long.class);
                var q = sq.from(com.arudra.crm.entity.Quotation.class);
                sq.select(q.get("id")).where(cb.equal(q.get("lead"), root));
                return cb.exists(sq);
            };

            // Requirement collected: any single piece of info captured — a finished requirement
            // task, a document/photo/voice note, a measurement, or saved task data.
            java.util.function.Supplier<Predicate> collected = () -> {
                var doneReqSq = query.subquery(Long.class);
                var dt = doneReqSq.from(com.arudra.crm.entity.Task.class);
                doneReqSq.select(dt.get("id")).where(cb.equal(dt.get("leadId"), root.get("id")),
                        cb.equal(dt.get("taskTemplate").get("code"), COLLECT_REQUIREMENT_CODE),
                        cb.equal(dt.get("status"), "COMPLETED"));
                var docSq = query.subquery(Long.class);
                var dc = docSq.from(com.arudra.crm.entity.LeadDocument.class);
                docSq.select(dc.get("id")).where(cb.equal(dc.get("lead"), root), notDeletedRow(cb, dc));
                var measSq = query.subquery(Long.class);
                var ms = measSq.from(com.arudra.crm.entity.Measurement.class);
                measSq.select(ms.get("id")).where(cb.equal(ms.get("lead"), root), notDeletedRow(cb, ms));
                var subSq = query.subquery(Long.class);
                var sb = subSq.from(com.arudra.crm.entity.LeadTaskSubmission.class);
                subSq.select(sb.get("id")).where(cb.equal(sb.get("leadId"), root.get("id")));
                return cb.or(cb.exists(doneReqSq), cb.exists(docSq), cb.exists(measSq), cb.exists(subSq));
            };

            // A live project wins over an older completed one (repeat customer, new job).
            java.util.function.Supplier<Predicate> open = () ->
                    cb.and(cb.not(lost.get()), cb.not(completed.get()), cb.not(live.get()));
            return switch (stage) {
                case STAGE_LOST -> lost.get();
                case STAGE_PROJECT -> cb.and(cb.not(lost.get()), live.get());
                case STAGE_COMPLETED -> cb.and(cb.not(lost.get()), cb.not(live.get()), completed.get());
                case STAGE_QUOTE -> cb.and(open.get(), quoted.get());
                case STAGE_COLLECTED -> cb.and(open.get(), cb.not(quoted.get()), collected.get());
                case STAGE_REQUIREMENT -> cb.and(open.get(), cb.not(quoted.get()), cb.not(collected.get()));
                default -> null;
            };
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
            // Categories are comma-separated ("Curtains, Blinds"), so match one entry of the list.
            return listContains("requirementCategory", category).toPredicate(root, query, cb);
        };
    }

    /** Lost leads live only behind the Lost card, so the working list hides them on request. */
    public static Specification<Lead> hideLost(Boolean hide) {
        return (root, query, cb) -> {
            if (!Boolean.TRUE.equals(hide)) return null;
            // Same rule as the Lost card: marked Lost, or its project was cancelled.
            return cb.not(journeyStage(STAGE_LOST).toPredicate(root, query, cb));
        };
    }

    /** Any of the lead's categories is one of the given names (case-insensitive). */
    public static Specification<Lead> categoryIn(List<String> names) {
        return (root, query, cb) -> {
            if (names == null || names.isEmpty()) return null;
            return cb.or(names.stream()
                    .map(n -> listContains("requirementCategory", n).toPredicate(root, query, cb))
                    .toArray(Predicate[]::new));
        };
    }

    /** Category is blank or none of the lead's categories is one of the given names — the "Others" bucket. */
    public static Specification<Lead> categoryNotIn(List<String> names) {
        return (root, query, cb) -> {
            if (names == null || names.isEmpty()) return null;
            return cb.or(cb.isNull(root.get("requirementCategory")),
                    cb.not(categoryIn(names).toPredicate(root, query, cb)));
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

    private static Predicate notDeletedRow(jakarta.persistence.criteria.CriteriaBuilder cb,
                                           jakarta.persistence.criteria.From<?, ?> row) {
        return cb.isFalse(cb.coalesce(row.<Boolean>get("isDeleted"), false));
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

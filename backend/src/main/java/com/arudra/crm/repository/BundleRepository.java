package com.arudra.crm.repository;

import com.arudra.crm.entity.Bundle;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface BundleRepository extends JpaRepository<Bundle, Long> {

    Optional<Bundle> findFirstByCodeIgnoreCaseAndIsDeletedFalse(String code);

    List<Bundle> findByGroupCodeIgnoreCaseAndIsDeletedFalseOrderByBundleNoAsc(String groupCode);

    List<Bundle> findByInvoiceIdAndIsDeletedFalseOrderByBundleNoAsc(Long invoiceId);

    /** The bundle behind a task-board task (tasks with source BUNDLE). */
    Optional<Bundle> findFirstByTaskIdAndIsDeletedFalse(Long taskId);

    List<Bundle> findByIsDeletedFalseAndStatusNotIn(List<String> statuses);

    /**
     * Filtered list for the Bundles screen. {@code q} matches the code or the customer's
     * name/phone; {@code overdueBefore} (today) keeps only open bundles past their due date.
     */
    @Query("SELECT b FROM Bundle b WHERE b.isDeleted = false " +
           "AND (:status IS NULL OR b.status = :status) " +
           "AND (:resourceType IS NULL OR (b.resourceType = :resourceType AND b.resourceId = :resourceId)) " +
           "AND (:overdueBefore IS NULL OR (b.dueDate < :overdueBefore " +
           "     AND b.status NOT IN ('DELIVERED','CANCELLED'))) " +
           "AND (:openOnly = false OR b.status NOT IN ('DELIVERED','CANCELLED')) " +
           "AND (:q IS NULL OR LOWER(b.code) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "     OR b.customerId IN (SELECT c.id FROM Customer c WHERE LOWER(c.name) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "                         OR c.phone LIKE CONCAT('%', :q, '%'))) " +
           "ORDER BY CASE WHEN b.dueDate IS NULL THEN 1 ELSE 0 END, b.dueDate ASC, b.id DESC")
    Page<Bundle> search(@Param("status") String status,
                        @Param("resourceType") String resourceType,
                        @Param("resourceId") Long resourceId,
                        @Param("overdueBefore") LocalDate overdueBefore,
                        @Param("openOnly") boolean openOnly,
                        @Param("q") String q,
                        Pageable pageable);
}

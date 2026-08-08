package com.arudra.crm.repository;

import com.arudra.crm.entity.Quotation;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.math.BigDecimal;

@Repository
public interface QuotationRepository extends JpaRepository<Quotation, Long>, JpaSpecificationExecutor<Quotation> {
    long countByStatus(String status);

    List<Quotation> findByParentQuotationIdOrderByRevisionNumberDesc(Long parentId);

    List<Quotation> findByCustomerId(Long customerId);

    List<Quotation> findByLeadIdOrderByCreatedAtDesc(Long leadId);

    Page<Quotation> findByCustomerId(Long customerId, Pageable pageable);

    @Query("SELECT q FROM Quotation q WHERE " +
            "LOWER(q.customer.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(q.quotationNumber) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(q.status) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Quotation> searchQuotations(@Param("search") String search, Pageable pageable);

    @Query("SELECT SUM(q.grandTotal) FROM Quotation q WHERE q.status = 'APPROVED'")
    BigDecimal sumTotalRevenue();

    @Query(value = "SELECT MONTHNAME(created_at) as month, SUM(grand_total) as revenue FROM quotations WHERE status = 'APPROVED' GROUP BY MONTH(created_at), MONTHNAME(created_at) ORDER BY MONTH(created_at)", nativeQuery = true)
    List<Object[]> getMonthlyRevenue();

    long countByQuotationMode(String quotationMode);

    long countByRevisionNumberGreaterThan(int revisionNumber);

    @Query("SELECT SUM(q.grandTotal) FROM Quotation q WHERE q.status = :status")
    BigDecimal sumGrandTotalByStatus(@Param("status") String status);

    boolean existsByBoqId(Long boqId);
}

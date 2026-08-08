package com.arudra.crm.repository;

import com.arudra.crm.entity.Invoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    Page<Invoice> findAllByOrderByDateDesc(Pageable pageable);
    List<Invoice> findByCustomerId(Long customerId);
    Page<Invoice> findByCustomerIdOrderByDateDesc(Long customerId, Pageable pageable);
    List<Invoice> findByProjectId(Long projectId);

    // --- Finance module ---
    Optional<Invoice> findTopByOrderByIdDesc();

    List<Invoice> findByQuotationIdAndInvoiceType(Long quotationId, String invoiceType);

    List<Invoice> findByStatusInAndDueDateBefore(List<String> statuses, LocalDate date);

    List<Invoice> findByStatusInAndIsDeletedFalse(List<String> statuses);

    List<Invoice> findByStatusInAndDueDateBetween(List<String> statuses, LocalDate from, LocalDate to);

    long countByStatusIn(List<String> statuses);

    @Query("select i from Invoice i where i.isDeleted = false " +
           "and (:status is null or i.status = :status) " +
           "and (:invoiceType is null or i.invoiceType = :invoiceType) " +
           "and (:customerId is null or i.customer.id = :customerId) " +
           "and (:projectId is null or i.project.id = :projectId) " +
           "and (:from is null or i.date >= :from) " +
           "and (:to is null or i.date <= :to) " +
           "and (:search is null or i.invoiceNumber like %:search% or i.customer.name like %:search%) " +
           "order by i.date desc, i.id desc")
    Page<Invoice> search(@Param("status") String status,
                         @Param("invoiceType") String invoiceType,
                         @Param("customerId") Long customerId,
                         @Param("projectId") Long projectId,
                         @Param("from") LocalDate from,
                         @Param("to") LocalDate to,
                         @Param("search") String search,
                         Pageable pageable);

    @Query("select coalesce(sum(i.balanceDue), 0) from Invoice i " +
           "where i.status in :statuses and i.isDeleted = false")
    BigDecimal sumBalanceDueByStatuses(@Param("statuses") List<String> statuses);

    @Query("select coalesce(sum(i.balanceDue), 0) from Invoice i " +
           "where i.status in :statuses and i.dueDate < :before and i.isDeleted = false")
    BigDecimal sumOverdueBalance(@Param("statuses") List<String> statuses, @Param("before") LocalDate before);

    @Query("select coalesce(sum(i.balanceDue), 0) from Invoice i " +
           "where i.customer.id = :customerId and i.status in :statuses and i.isDeleted = false")
    BigDecimal sumBalanceDueForCustomer(@Param("customerId") Long customerId, @Param("statuses") List<String> statuses);

    @Query("select coalesce(sum(i.totalAmount), 0) from Invoice i " +
           "where i.date between :from and :to and i.status <> 'CANCELLED' and i.status <> 'DRAFT' and i.isDeleted = false")
    BigDecimal sumInvoicedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    List<Invoice> findByDateBetweenAndStatusNotInAndIsDeletedFalse(LocalDate from, LocalDate to, List<String> excludedStatuses);
}

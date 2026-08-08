package com.arudra.crm.repository;

import com.arudra.crm.entity.CustomerPayment;
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
public interface CustomerPaymentRepository extends JpaRepository<CustomerPayment, Long> {
    Page<CustomerPayment> findAllByOrderByPaymentDateDesc(Pageable pageable);
    List<CustomerPayment> findByInvoiceId(Long invoiceId);
    List<CustomerPayment> findByCustomerId(Long customerId);
    Page<CustomerPayment> findByCustomerIdOrderByPaymentDateDesc(Long customerId, Pageable pageable);


    // For advance payments not tied to invoice
    List<CustomerPayment> findByInvoiceIsNull();

    // --- Finance module ---
    Optional<CustomerPayment> findTopByOrderByIdDesc();

    List<CustomerPayment> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);

    List<CustomerPayment> findByProjectIdAndIsDeletedFalseOrderByPaymentDateDesc(Long projectId);

    @Query("select p from CustomerPayment p where p.isDeleted = false " +
           "and (:status is null or p.status = :status) " +
           "and (:customerId is null or p.customer.id = :customerId) " +
           "and (:projectId is null or p.project.id = :projectId) " +
           "and (:method is null or p.paymentMethod = :method) " +
           "and (:from is null or p.paymentDate >= :from) " +
           "and (:to is null or p.paymentDate <= :to) " +
           "and (:search is null or p.paymentNumber like %:search% or p.referenceNumber like %:search% or p.customer.name like %:search%) " +
           "order by p.paymentDate desc, p.id desc")
    Page<CustomerPayment> search(@Param("status") String status,
                                 @Param("customerId") Long customerId,
                                 @Param("projectId") Long projectId,
                                 @Param("method") String method,
                                 @Param("from") LocalDate from,
                                 @Param("to") LocalDate to,
                                 @Param("search") String search,
                                 Pageable pageable);

    @Query("select coalesce(sum(p.amount), 0) from CustomerPayment p " +
           "where p.status = 'CONFIRMED' and p.paymentDate between :from and :to and p.isDeleted = false")
    BigDecimal sumConfirmedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select coalesce(sum(p.amount), 0) from CustomerPayment p " +
           "where p.status = 'CONFIRMED' and p.project.id = :projectId and p.isDeleted = false")
    BigDecimal sumConfirmedForProject(@Param("projectId") Long projectId);

    @Query("select max(p.paymentDate) from CustomerPayment p " +
           "where p.status = 'CONFIRMED' and p.customer.id = :customerId and p.isDeleted = false")
    LocalDate lastPaymentDateForCustomer(@Param("customerId") Long customerId);

    List<CustomerPayment> findByStatusAndPaymentDateBetweenAndIsDeletedFalse(String status, LocalDate from, LocalDate to);
}

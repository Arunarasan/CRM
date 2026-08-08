package com.arudra.crm.repository;

import com.arudra.crm.entity.CustomerLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface CustomerLedgerEntryRepository extends JpaRepository<CustomerLedgerEntry, Long> {

    List<CustomerLedgerEntry> findByCustomerIdAndIsDeletedFalseOrderByEntryDateAscIdAsc(Long customerId);

    List<CustomerLedgerEntry> findByCustomerIdAndEntryDateBetweenAndIsDeletedFalseOrderByEntryDateAscIdAsc(
            Long customerId, LocalDate from, LocalDate to);

    boolean existsByReferenceTypeAndReferenceIdAndEntryType(String referenceType, Long referenceId, String entryType);

    /** Net balance movement (debit - credit) for a customer strictly before a date. */
    @Query("select coalesce(sum(e.debit - e.credit), 0) from CustomerLedgerEntry e " +
           "where e.customer.id = :customerId and e.entryDate < :before and e.isDeleted = false")
    BigDecimal netBalanceBefore(@Param("customerId") Long customerId, @Param("before") LocalDate before);

    @Query("select coalesce(sum(e.debit - e.credit), 0) from CustomerLedgerEntry e " +
           "where e.customer.id = :customerId and e.isDeleted = false")
    BigDecimal netBalance(@Param("customerId") Long customerId);
}

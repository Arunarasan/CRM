package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorLedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ContractorLedgerEntryRepository extends JpaRepository<ContractorLedgerEntry, Long> {

    List<ContractorLedgerEntry> findByContractorIdOrderByEntryDateAscIdAsc(Long contractorId);

    List<ContractorLedgerEntry> findByContractorIdAndEntryDateBetweenOrderByEntryDateAscIdAsc(
            Long contractorId, LocalDate from, LocalDate to);

    /** Postings are idempotent — the service checks this before writing a ledger row. */
    boolean existsByReferenceTypeAndReferenceIdAndEntryType(String referenceType, Long referenceId, String entryType);

    @Query("SELECT COALESCE(SUM(e.credit) - SUM(e.debit), 0) FROM ContractorLedgerEntry e " +
           "WHERE e.contractor.id = :contractorId AND e.isDeleted = false")
    BigDecimal balanceForContractor(@Param("contractorId") Long contractorId);
}

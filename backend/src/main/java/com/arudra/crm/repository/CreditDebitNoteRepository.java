package com.arudra.crm.repository;

import com.arudra.crm.entity.CreditDebitNote;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CreditDebitNoteRepository extends JpaRepository<CreditDebitNote, Long> {
    Page<CreditDebitNote> findAllByOrderByDateDesc(Pageable pageable);
    List<CreditDebitNote> findByInvoiceId(Long invoiceId);
    List<CreditDebitNote> findByCustomerId(Long customerId);
    Page<CreditDebitNote> findByCustomerIdOrderByDateDesc(Long customerId, Pageable pageable);

    // --- Finance module ---
    java.util.Optional<CreditDebitNote> findTopByOrderByIdDesc();
}

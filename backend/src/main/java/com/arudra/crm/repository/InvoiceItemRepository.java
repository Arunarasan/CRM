package com.arudra.crm.repository;

import com.arudra.crm.entity.InvoiceItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface InvoiceItemRepository extends JpaRepository<InvoiceItem, Long> {
    List<InvoiceItem> findByInvoiceId(Long invoiceId);

    /** HSN-wise taxable value and tax for the GST report (issued, non-cancelled invoices only). */
    @Query("select coalesce(it.hsnCode, 'N/A'), it.gstRate, " +
           "coalesce(sum(it.unitPrice * it.quantity), 0), " +
           "coalesce(sum(it.unitPrice * it.quantity * it.gstRate / 100), 0) " +
           "from InvoiceItem it " +
           "where it.invoice.date between :from and :to " +
           "and it.invoice.status not in ('DRAFT', 'CANCELLED') and it.invoice.isDeleted = false " +
           "group by coalesce(it.hsnCode, 'N/A'), it.gstRate")
    List<Object[]> hsnSummaryBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}

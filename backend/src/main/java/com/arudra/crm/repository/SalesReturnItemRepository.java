package com.arudra.crm.repository;

import com.arudra.crm.entity.SalesReturnItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SalesReturnItemRepository extends JpaRepository<SalesReturnItem, Long> {
    List<SalesReturnItem> findBySalesReturnId(Long salesReturnId);

    /** Sum of quantities already returned for a given invoice line — caps how much more can be returned. */
    @org.springframework.data.jpa.repository.Query(
        "select coalesce(sum(i.quantity), 0) from SalesReturnItem i " +
        "where i.invoiceItemId = :invoiceItemId and i.isDeleted = false")
    int totalReturnedForInvoiceItem(Long invoiceItemId);
}

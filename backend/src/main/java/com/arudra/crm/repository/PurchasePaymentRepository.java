package com.arudra.crm.repository;

import com.arudra.crm.entity.PurchasePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface PurchasePaymentRepository extends JpaRepository<PurchasePayment, Long> {
    List<PurchasePayment> findByPurchaseBillId(Long purchaseBillId);
    List<PurchasePayment> findByPurchaseOrderId(Long purchaseOrderId);
    List<PurchasePayment> findBySupplierIdOrderByPaymentDateDesc(Long supplierId);
    List<PurchasePayment> findAllByOrderByIdDesc();
    List<PurchasePayment> findByPaymentDateBetween(java.time.LocalDate from, java.time.LocalDate to);

    /** Actual cash paid to suppliers for a project — reached via the PO directly or via the bill's PO. */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM PurchasePayment p " +
           "WHERE p.isDeleted = false AND (" +
           "p.purchaseOrder.project.id = :projectId OR p.purchaseBill.purchaseOrder.project.id = :projectId)")
    BigDecimal sumForProject(@Param("projectId") Long projectId);
}

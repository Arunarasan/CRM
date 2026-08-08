package com.arudra.crm.repository;

import com.arudra.crm.entity.PurchasePayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchasePaymentRepository extends JpaRepository<PurchasePayment, Long> {
    List<PurchasePayment> findByPurchaseBillId(Long purchaseBillId);
    List<PurchasePayment> findByPurchaseOrderId(Long purchaseOrderId);
    List<PurchasePayment> findBySupplierIdOrderByPaymentDateDesc(Long supplierId);
    List<PurchasePayment> findAllByOrderByIdDesc();
    List<PurchasePayment> findByPaymentDateBetween(java.time.LocalDate from, java.time.LocalDate to);
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.PurchaseBill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface PurchaseBillRepository extends JpaRepository<PurchaseBill, Long> {
    List<PurchaseBill> findByPurchaseOrderId(Long purchaseOrderId);
    List<PurchaseBill> findBySupplierId(Long supplierId);
    List<PurchaseBill> findAllByOrderByIdDesc();
    List<PurchaseBill> findByStatusInOrderByDueDateAsc(List<String> statuses);
    List<PurchaseBill> findByStatusInAndDueDateBetween(List<String> statuses, LocalDate from, LocalDate to);
    List<PurchaseBill> findByStatusInAndDueDateBefore(List<String> statuses, LocalDate date);
    List<PurchaseBill> findByPurchaseOrderProjectIdAndIsDeletedFalse(Long projectId);
}

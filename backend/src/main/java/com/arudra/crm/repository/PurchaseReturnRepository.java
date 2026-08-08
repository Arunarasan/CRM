package com.arudra.crm.repository;

import com.arudra.crm.entity.PurchaseReturn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseReturnRepository extends JpaRepository<PurchaseReturn, Long> {
    List<PurchaseReturn> findAllByOrderByIdDesc();
    boolean existsByReturnNumber(String returnNumber);
    List<PurchaseReturn> findByPurchaseOrderId(Long purchaseOrderId);
    List<PurchaseReturn> findBySupplierId(Long supplierId);
}

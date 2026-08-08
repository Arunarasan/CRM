package com.arudra.crm.repository;

import com.arudra.crm.entity.GoodsReceiptNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GoodsReceiptNoteRepository extends JpaRepository<GoodsReceiptNote, Long> {
    List<GoodsReceiptNote> findByPurchaseOrderId(Long purchaseOrderId);
    boolean existsByGrnNumber(String grnNumber);
    List<GoodsReceiptNote> findAllByOrderByIdDesc();
    long countByStatus(String status);
}

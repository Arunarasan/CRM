package com.arudra.crm.repository;

import com.arudra.crm.entity.GoodsReceiptNoteItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GoodsReceiptNoteItemRepository extends JpaRepository<GoodsReceiptNoteItem, Long> {
    List<GoodsReceiptNoteItem> findByGrnId(Long grnId);
}

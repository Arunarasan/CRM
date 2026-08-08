package com.arudra.crm.repository;

import com.arudra.crm.entity.InventoryItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface InventoryItemRepository extends JpaRepository<InventoryItem, Long> {
    Optional<InventoryItem> findByProductIdAndWarehouseId(Long productId, Long warehouseId);
    
    List<InventoryItem> findByWarehouseId(Long warehouseId);
    
    List<InventoryItem> findByProductId(Long productId);
    
    @Query("SELECT i FROM InventoryItem i WHERE i.quantity < i.product.minStockLevel")
    List<InventoryItem> findLowStockItems();
}

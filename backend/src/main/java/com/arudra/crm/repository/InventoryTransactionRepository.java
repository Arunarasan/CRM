package com.arudra.crm.repository;

import com.arudra.crm.entity.InventoryTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryTransactionRepository extends JpaRepository<InventoryTransaction, Long> {
    Page<InventoryTransaction> findAllByOrderByDateDesc(Pageable pageable);
    
    List<InventoryTransaction> findTop50ByOrderByDateDesc();

    List<InventoryTransaction> findByProductIdOrderByDateDesc(Long productId);

    List<InventoryTransaction> findByTypeAndDateBetween(String type, java.time.LocalDateTime from, java.time.LocalDateTime to);

    List<InventoryTransaction> findByDateAfter(java.time.LocalDateTime from);

    List<InventoryTransaction> findByTypeAndProjectId(String type, Long projectId);

    List<InventoryTransaction> findByProjectIdOrderByDateDesc(Long projectId);
}

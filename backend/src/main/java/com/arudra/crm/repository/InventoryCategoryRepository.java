package com.arudra.crm.repository;

import com.arudra.crm.entity.InventoryCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface InventoryCategoryRepository extends JpaRepository<InventoryCategory, Long> {
}

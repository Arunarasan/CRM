package com.arudra.crm.repository;

import com.arudra.crm.entity.BoqItemMaterial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BoqItemMaterialRepository extends JpaRepository<BoqItemMaterial, Long> {
    List<BoqItemMaterial> findByItemId(Long itemId);

    List<BoqItemMaterial> findByItemBoqId(Long boqId);
}

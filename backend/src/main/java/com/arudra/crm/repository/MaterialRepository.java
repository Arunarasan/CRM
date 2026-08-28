package com.arudra.crm.repository;

import com.arudra.crm.entity.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MaterialRepository extends JpaRepository<Material, Long> {
    Optional<Material> findBySlugAndIsDeletedFalse(String slug);
    List<Material> findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc();

    // ---- Admin (CMS) ----
    List<Material> findByIsDeletedFalseOrderByDisplayOrderAsc();
    Optional<Material> findByIdAndIsDeletedFalse(Long id);
    boolean existsBySlugAndIsDeletedFalse(String slug);
}

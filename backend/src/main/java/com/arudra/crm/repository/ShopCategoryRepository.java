package com.arudra.crm.repository;

import com.arudra.crm.entity.ShopCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopCategoryRepository extends JpaRepository<ShopCategory, Long> {
    Optional<ShopCategory> findBySlug(String slug);
    List<ShopCategory> findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc();

    // ---- Admin (CMS) ----
    List<ShopCategory> findByIsDeletedFalseOrderByDisplayOrderAsc();
    Optional<ShopCategory> findByIdAndIsDeletedFalse(Long id);
    boolean existsBySlugAndIsDeletedFalse(String slug);
}

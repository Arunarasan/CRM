package com.arudra.crm.repository;

import com.arudra.crm.entity.ShopProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShopProductRepository extends JpaRepository<ShopProduct, Long> {
    Optional<ShopProduct> findBySlugAndActiveTrueAndIsDeletedFalse(String slug);
    List<ShopProduct> findByActiveTrueAndIsDeletedFalseOrderByIdDesc();
    List<ShopProduct> findByFeaturedTrueAndActiveTrueAndIsDeletedFalseOrderByIdDesc();
    List<ShopProduct> findByCategory_SlugAndActiveTrueAndIsDeletedFalse(String categorySlug);

    // ---- Admin (CMS) ----
    List<ShopProduct> findByIsDeletedFalseOrderByIdDesc();
    Optional<ShopProduct> findByIdAndIsDeletedFalse(Long id);
    boolean existsBySlugAndIsDeletedFalse(String slug);
}

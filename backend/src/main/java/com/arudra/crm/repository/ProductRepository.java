package com.arudra.crm.repository;

import com.arudra.crm.entity.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {
    // LEFT JOIN so products without a category still match name/code searches (the old
    // implicit p.category.name path inner-joined and silently excluded them).
    @Query("SELECT p FROM Product p LEFT JOIN p.category c WHERE " +
           "LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.sku) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.materialCode) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.barcode) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(p.brand) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(c.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Product> searchProducts(@Param("search") String search, Pageable pageable);

    java.util.Optional<Product> findFirstByMaterialCodeIgnoreCaseOrSkuIgnoreCaseOrBarcodeOrQrCode(
            String materialCode, String sku, String barcode, String qrCode);
}

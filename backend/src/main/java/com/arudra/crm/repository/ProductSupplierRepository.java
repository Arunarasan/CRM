package com.arudra.crm.repository;

import com.arudra.crm.entity.ProductSupplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProductSupplierRepository extends JpaRepository<ProductSupplier, Long> {
    List<ProductSupplier> findByProductId(Long productId);
}

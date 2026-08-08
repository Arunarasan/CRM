package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationDiscount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuotationDiscountRepository extends JpaRepository<QuotationDiscount, Long> {
    List<QuotationDiscount> findByQuotationId(Long quotationId);
}

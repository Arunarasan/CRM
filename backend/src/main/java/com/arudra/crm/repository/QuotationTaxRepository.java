package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationTax;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuotationTaxRepository extends JpaRepository<QuotationTax, Long> {
    List<QuotationTax> findByQuotationId(Long quotationId);
}

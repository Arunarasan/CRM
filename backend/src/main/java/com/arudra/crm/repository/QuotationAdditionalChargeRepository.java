package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationAdditionalCharge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuotationAdditionalChargeRepository extends JpaRepository<QuotationAdditionalCharge, Long> {
    List<QuotationAdditionalCharge> findByQuotationId(Long quotationId);
}

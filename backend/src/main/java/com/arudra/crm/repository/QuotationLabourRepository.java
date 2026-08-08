package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationLabour;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuotationLabourRepository extends JpaRepository<QuotationLabour, Long> {
    List<QuotationLabour> findByQuotationId(Long quotationId);
}

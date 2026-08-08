package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationTerm;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuotationTermRepository extends JpaRepository<QuotationTerm, Long> {
    List<QuotationTerm> findByQuotationId(Long quotationId);
}

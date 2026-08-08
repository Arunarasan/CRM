package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationNegotiation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuotationNegotiationRepository extends JpaRepository<QuotationNegotiation, Long> {
    List<QuotationNegotiation> findByQuotationIdOrderByRevisionNumberDesc(Long quotationId);
}

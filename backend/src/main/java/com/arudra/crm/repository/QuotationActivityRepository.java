package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuotationActivityRepository extends JpaRepository<QuotationActivity, Long> {
    List<QuotationActivity> findByQuotationIdOrderByCreatedAtDesc(Long quotationId);
}

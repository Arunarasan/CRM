package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuotationApprovalRepository extends JpaRepository<QuotationApproval, Long> {
    List<QuotationApproval> findByQuotationId(Long quotationId);
}

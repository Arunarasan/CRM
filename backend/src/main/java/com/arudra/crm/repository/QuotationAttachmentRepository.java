package com.arudra.crm.repository;

import com.arudra.crm.entity.QuotationAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface QuotationAttachmentRepository extends JpaRepository<QuotationAttachment, Long> {
    List<QuotationAttachment> findByQuotationId(Long quotationId);
}

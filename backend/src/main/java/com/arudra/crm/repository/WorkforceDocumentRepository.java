package com.arudra.crm.repository;

import com.arudra.crm.entity.WorkforceDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkforceDocumentRepository extends JpaRepository<WorkforceDocument, Long> {

    List<WorkforceDocument> findByWorkforceIdAndIsDeletedFalseOrderByCreatedAtDesc(Long workforceId);
}

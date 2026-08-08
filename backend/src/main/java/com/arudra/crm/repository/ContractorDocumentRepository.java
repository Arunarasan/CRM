package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ContractorDocumentRepository extends JpaRepository<ContractorDocument, Long> {

    List<ContractorDocument> findByContractorId(Long contractorId);

    List<ContractorDocument> findByContractorIdAndType(Long contractorId, String type);

    @Query("SELECT d FROM ContractorDocument d WHERE d.expiryDate IS NOT NULL AND d.expiryDate <= :cutoff " +
           "AND d.isDeleted = false ORDER BY d.expiryDate ASC")
    List<ContractorDocument> findExpiringBefore(@Param("cutoff") LocalDate cutoff);
}

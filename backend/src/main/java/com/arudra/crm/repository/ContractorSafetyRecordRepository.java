package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorSafetyRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractorSafetyRecordRepository extends JpaRepository<ContractorSafetyRecord, Long> {
    List<ContractorSafetyRecord> findByContractorIdOrderByIdDesc(Long contractorId);
    List<ContractorSafetyRecord> findByWorkPackageIdOrderByIdDesc(Long workPackageId);
    List<ContractorSafetyRecord> findByProjectIdOrderByIdDesc(Long projectId);
    long countByContractorIdAndRecordType(Long contractorId, String recordType);
}

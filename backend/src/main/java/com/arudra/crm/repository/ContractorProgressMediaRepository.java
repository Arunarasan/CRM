package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorProgressMedia;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractorProgressMediaRepository extends JpaRepository<ContractorProgressMedia, Long> {
    List<ContractorProgressMedia> findByProgressIdOrderByIdAsc(Long progressId);
    List<ContractorProgressMedia> findByInspectionIdOrderByIdAsc(Long inspectionId);
}

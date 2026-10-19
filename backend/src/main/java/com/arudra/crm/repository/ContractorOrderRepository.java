package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractorOrderRepository extends JpaRepository<ContractorOrder, Long> {

    List<ContractorOrder> findByContractorIdAndIsDeletedFalseOrderByOrderDateDescIdDesc(Long contractorId);
}

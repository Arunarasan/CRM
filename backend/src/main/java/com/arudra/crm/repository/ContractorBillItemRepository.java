package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorBillItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContractorBillItemRepository extends JpaRepository<ContractorBillItem, Long> {
    List<ContractorBillItem> findByBillIdOrderByIdAsc(Long billId);
}

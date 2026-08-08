package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorBillApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ContractorBillApprovalRepository extends JpaRepository<ContractorBillApproval, Long> {

    List<ContractorBillApproval> findByBillIdOrderBySequenceAsc(Long billId);

    /** The rung currently awaiting action. */
    Optional<ContractorBillApproval> findFirstByBillIdAndStatusOrderBySequenceAsc(Long billId, String status);

    List<ContractorBillApproval> findByStageAndStatusOrderByIdAsc(String stage, String status);
}

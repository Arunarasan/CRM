package com.arudra.crm.repository;

import com.arudra.crm.entity.PurchaseRequestApproval;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseRequestApprovalRepository extends JpaRepository<PurchaseRequestApproval, Long> {
    List<PurchaseRequestApproval> findByPurchaseRequestIdOrderByLevelAsc(Long purchaseRequestId);
    Optional<PurchaseRequestApproval> findFirstByPurchaseRequestIdAndStatusOrderByLevelAsc(Long purchaseRequestId, String status);
}

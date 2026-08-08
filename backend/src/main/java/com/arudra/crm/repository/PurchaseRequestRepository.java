package com.arudra.crm.repository;

import com.arudra.crm.entity.PurchaseRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PurchaseRequestRepository extends JpaRepository<PurchaseRequest, Long> {
    List<PurchaseRequest> findAllByOrderByIdDesc();
    boolean existsByRequestNumber(String requestNumber);
    List<PurchaseRequest> findByStatusOrderByIdDesc(String status);
    List<PurchaseRequest> findByRequestedByIdOrderByIdDesc(Long requestedById);
    List<PurchaseRequest> findByProjectIdOrderByIdDesc(Long projectId);
    long countByStatus(String status);
    Optional<PurchaseRequest> findFirstByProductIdAndWarehouseIdAndStatus(Long productId, Long warehouseId, String status);
}

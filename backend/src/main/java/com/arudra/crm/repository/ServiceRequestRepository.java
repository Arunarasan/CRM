package com.arudra.crm.repository;

import com.arudra.crm.entity.ServiceRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long> {
    List<ServiceRequest> findByCustomer_IdAndIsDeletedFalseOrderByCreatedAtDesc(Long customerId);

    // ---- CRM admin (service-request inbox) ----
    List<ServiceRequest> findByIsDeletedFalseOrderByCreatedAtDesc();
    List<ServiceRequest> findByStatusAndIsDeletedFalseOrderByCreatedAtDesc(String status);
    java.util.Optional<ServiceRequest> findByIdAndIsDeletedFalse(Long id);
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.CustomerNotification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomerNotificationRepository extends JpaRepository<CustomerNotification, Long> {
    List<CustomerNotification> findByCustomer_IdAndIsDeletedFalseOrderByCreatedAtDesc(Long customerId);
    long countByCustomer_IdAndReadAtIsNullAndIsDeletedFalse(Long customerId);
}

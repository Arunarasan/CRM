package com.arudra.crm.repository;

import com.arudra.crm.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByCustomer_IdAndIsDeletedFalseOrderByCreatedAtDesc(Long customerId);
    Optional<Order> findByOrderNumber(String orderNumber);

    // ---- CRM admin (website order management) ----
    List<Order> findByIsDeletedFalseOrderByCreatedAtDesc();
    List<Order> findByStatusAndIsDeletedFalseOrderByCreatedAtDesc(String status);
    Optional<Order> findByIdAndIsDeletedFalse(Long id);
}

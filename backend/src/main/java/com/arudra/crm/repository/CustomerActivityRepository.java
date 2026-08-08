package com.arudra.crm.repository;

import com.arudra.crm.entity.CustomerActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomerActivityRepository extends JpaRepository<CustomerActivity, Long> {
    List<CustomerActivity> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    Page<CustomerActivity> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);
}

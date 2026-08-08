package com.arudra.crm.repository;

import com.arudra.crm.entity.Refund;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RefundRepository extends JpaRepository<Refund, Long> {
    Page<Refund> findByIsDeletedFalseOrderByIdDesc(Pageable pageable);
    List<Refund> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);
    List<Refund> findByCustomerIdAndIsDeletedFalseOrderByIdDesc(Long customerId);
    Optional<Refund> findTopByOrderByIdDesc();
}

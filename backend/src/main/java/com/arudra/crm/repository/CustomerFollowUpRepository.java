package com.arudra.crm.repository;

import com.arudra.crm.entity.CustomerFollowUp;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface CustomerFollowUpRepository extends JpaRepository<CustomerFollowUp, Long> {

    Page<CustomerFollowUp> findByCustomerIdOrderByFollowupDateAsc(Long customerId, Pageable pageable);

    Page<CustomerFollowUp> findByCustomerIdAndStatusOrderByFollowupDateAsc(Long customerId, String status, Pageable pageable);

    List<CustomerFollowUp> findByCustomerIdAndStatusAndFollowupDate(Long customerId, String status, LocalDate followupDate);

    List<CustomerFollowUp> findByCustomerIdAndStatusAndFollowupDateBefore(Long customerId, String status, LocalDate date);

    List<CustomerFollowUp> findByCustomerIdAndStatusAndFollowupDateAfter(Long customerId, String status, LocalDate date);

    long countByCustomerIdAndStatus(Long customerId, String status);
}

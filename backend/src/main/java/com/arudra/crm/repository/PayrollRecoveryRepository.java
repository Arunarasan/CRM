package com.arudra.crm.repository;

import com.arudra.crm.entity.PayrollRecovery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PayrollRecoveryRepository extends JpaRepository<PayrollRecovery, Long> {
    List<PayrollRecovery> findBySalaryRecordId(Long salaryRecordId);
}

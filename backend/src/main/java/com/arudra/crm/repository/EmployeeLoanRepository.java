package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeLoan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface EmployeeLoanRepository extends JpaRepository<EmployeeLoan, Long> {

    List<EmployeeLoan> findByEmployeeIdOrderByIdDesc(Long employeeId);

    /** Active loans (balance>0) a payroll run should recover EMI from, oldest first. */
    List<EmployeeLoan> findByEmployeeIdAndStatusAndBalanceGreaterThanOrderByIdAsc(
            Long employeeId, String status, BigDecimal minBalance);

    @Query("SELECT COALESCE(SUM(l.balance), 0) FROM EmployeeLoan l " +
           "WHERE l.isDeleted = false AND l.status = 'ACTIVE'")
    BigDecimal sumOutstandingLoans();
}

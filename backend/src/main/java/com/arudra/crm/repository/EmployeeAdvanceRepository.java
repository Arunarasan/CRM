package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeAdvance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface EmployeeAdvanceRepository extends JpaRepository<EmployeeAdvance, Long> {

    List<EmployeeAdvance> findByEmployeeIdOrderByIdDesc(Long employeeId);

    /** Active advances (APPROVED/RECOVERING, balance>0) that a payroll run should recover from, oldest first. */
    List<EmployeeAdvance> findByEmployeeIdAndStatusInAndBalanceGreaterThanOrderByIdAsc(
            Long employeeId, List<String> statuses, BigDecimal minBalance);

    @Query("SELECT COALESCE(SUM(a.balance), 0) FROM EmployeeAdvance a " +
           "WHERE a.isDeleted = false AND a.status IN ('APPROVED', 'RECOVERING')")
    BigDecimal sumOutstandingAdvances();
}

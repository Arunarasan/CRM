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

    /** Principal disbursed as loans in a period. */
    @Query("SELECT COALESCE(SUM(l.principal), 0) FROM EmployeeLoan l WHERE l.disbursedDate BETWEEN :from AND :to")
    BigDecimal sumDisbursedBetween(@org.springframework.data.repository.query.Param("from") java.time.LocalDate from,
                                   @org.springframework.data.repository.query.Param("to") java.time.LocalDate to);

    /** Loans disbursed in a period (for the cashflow detail list). */
    List<EmployeeLoan> findByDisbursedDateBetweenOrderByDisbursedDateDesc(java.time.LocalDate from, java.time.LocalDate to);

    /** Remaining balance on loans DISBURSED within a period — the month-scoped "loans outstanding". */
    @Query("SELECT COALESCE(SUM(l.balance), 0) FROM EmployeeLoan l " +
           "WHERE l.disbursedDate BETWEEN :from AND :to AND l.balance > 0")
    BigDecimal sumBalanceDisbursedBetween(@org.springframework.data.repository.query.Param("from") java.time.LocalDate from,
                                          @org.springframework.data.repository.query.Param("to") java.time.LocalDate to);
}

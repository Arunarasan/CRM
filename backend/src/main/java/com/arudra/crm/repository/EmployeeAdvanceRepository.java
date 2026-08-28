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

    /** Cash actually disbursed as advances in a period (approved/recovering/recovered, not pending/rejected). */
    @Query("SELECT COALESCE(SUM(a.amount), 0) FROM EmployeeAdvance a " +
           "WHERE a.advanceDate BETWEEN :from AND :to AND a.status NOT IN ('PENDING','REJECTED')")
    BigDecimal sumGivenBetween(@org.springframework.data.repository.query.Param("from") java.time.LocalDate from,
                               @org.springframework.data.repository.query.Param("to") java.time.LocalDate to);

    /** Remaining balance on advances GIVEN within a period — the month-scoped "advances to recover". */
    @Query("SELECT COALESCE(SUM(a.balance), 0) FROM EmployeeAdvance a " +
           "WHERE a.advanceDate BETWEEN :from AND :to AND a.balance > 0 AND a.status NOT IN ('PENDING','REJECTED')")
    BigDecimal sumBalanceGivenBetween(@org.springframework.data.repository.query.Param("from") java.time.LocalDate from,
                                      @org.springframework.data.repository.query.Param("to") java.time.LocalDate to);

    /** Advances disbursed in a period (for the cashflow detail list). */
    List<EmployeeAdvance> findByAdvanceDateBetweenAndStatusNotInOrderByAdvanceDateDesc(
            java.time.LocalDate from, java.time.LocalDate to, java.util.Collection<String> statuses);
}

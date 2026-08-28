package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeBonus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EmployeeBonusRepository extends JpaRepository<EmployeeBonus, Long> {

    /** Bonuses paid directly (not absorbed into a payslip) in a period — real extra cash out. */
    @Query("SELECT COALESCE(SUM(b.amount), 0) FROM EmployeeBonus b " +
           "WHERE b.status = 'PAID' AND b.paidSalaryRecordId IS NULL AND b.isDeleted = false " +
           "AND b.paidAt BETWEEN :from AND :to")
    BigDecimal sumDirectPaidBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** Directly-paid bonuses in a period (for the cashflow detail list). */
    @Query("SELECT b FROM EmployeeBonus b " +
           "WHERE b.status = 'PAID' AND b.paidSalaryRecordId IS NULL AND b.isDeleted = false " +
           "AND b.paidAt BETWEEN :from AND :to ORDER BY b.paidAt DESC")
    List<EmployeeBonus> findDirectPaidBetween(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    List<EmployeeBonus> findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(Long employeeId);

    List<EmployeeBonus> findByIsDeletedFalseOrderByIdDesc();

    List<EmployeeBonus> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);

    /** Approved bonuses not yet absorbed into a payslip — candidates for a payroll run. */
    List<EmployeeBonus> findByEmployeeIdAndStatusAndPaidSalaryRecordIdIsNullAndIsDeletedFalse(
            Long employeeId, String status);
}

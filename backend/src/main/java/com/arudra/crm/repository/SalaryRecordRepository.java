package com.arudra.crm.repository;

import com.arudra.crm.entity.SalaryRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface SalaryRecordRepository extends JpaRepository<SalaryRecord, Long> {
    Page<SalaryRecord> findAllByOrderByYearDescMonthDesc(Pageable pageable);
    List<SalaryRecord> findByEmployeeIdOrderByYearDescMonthDesc(Long employeeId);
    List<SalaryRecord> findByStatusAndPaymentDateBetween(String status, java.time.LocalDate from, java.time.LocalDate to);

    // Payroll run (V19): idempotency guard + register + dashboard sums.
    Optional<SalaryRecord> findByEmployeeIdAndMonthAndYear(Long employeeId, Integer month, Integer year);
    List<SalaryRecord> findByMonthAndYearOrderByIdDesc(Integer month, Integer year);

    @Query("SELECT COALESCE(SUM(s.netSalary), 0) FROM SalaryRecord s " +
           "WHERE s.isDeleted = false AND s.month = :month AND s.year = :year AND s.status = :status")
    BigDecimal sumNetByMonthYearAndStatus(@Param("month") Integer month,
                                          @Param("year") Integer year,
                                          @Param("status") String status);

    @Query("SELECT COALESCE(SUM(s.netSalary), 0) FROM SalaryRecord s " +
           "WHERE s.isDeleted = false AND s.year = :year AND s.status = 'PAID'")
    BigDecimal sumPaidNetByYear(@Param("year") Integer year);
}

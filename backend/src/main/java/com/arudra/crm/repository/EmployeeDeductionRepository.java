package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeDeduction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeDeductionRepository extends JpaRepository<EmployeeDeduction, Long> {

    List<EmployeeDeduction> findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(Long employeeId);

    List<EmployeeDeduction> findByIsDeletedFalseOrderByIdDesc();

    List<EmployeeDeduction> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);

    /** Approved, not-yet-applied deductions for an employee — candidates for the next payroll run. */
    List<EmployeeDeduction> findByEmployeeIdAndStatusAndAppliedSalaryRecordIdIsNullAndIsDeletedFalse(
            Long employeeId, String status);
}

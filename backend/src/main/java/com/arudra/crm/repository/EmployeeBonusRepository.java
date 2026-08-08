package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeBonus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeBonusRepository extends JpaRepository<EmployeeBonus, Long> {

    List<EmployeeBonus> findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(Long employeeId);

    List<EmployeeBonus> findByIsDeletedFalseOrderByIdDesc();

    List<EmployeeBonus> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);

    /** Approved bonuses not yet absorbed into a payslip — candidates for a payroll run. */
    List<EmployeeBonus> findByEmployeeIdAndStatusAndPaidSalaryRecordIdIsNullAndIsDeletedFalse(
            Long employeeId, String status);
}

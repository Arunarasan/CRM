package com.arudra.crm.repository;

import com.arudra.crm.entity.PayrollRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PayrollRequestRepository extends JpaRepository<PayrollRequest, Long> {

    /** Requests raised by a given login, most recent first. */
    List<PayrollRequest> findByRequestedByIdAndIsDeletedFalseOrderByIdDesc(Long requestedById);

    /** All requests for an employee (HR view), most recent first. */
    List<PayrollRequest> findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(Long employeeId);

    List<PayrollRequest> findByIsDeletedFalseOrderByIdDesc();

    List<PayrollRequest> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);

    /**
     * Approved, not-yet-applied month-targeted requests (LOAN_REPAYMENT / OTHER) an employee has for
     * a period — the candidates a payroll run absorbs.
     */
    List<PayrollRequest> findByEmployeeIdAndStatusAndAppliedSalaryRecordIdIsNullAndIsDeletedFalse(
            Long employeeId, String status);
}

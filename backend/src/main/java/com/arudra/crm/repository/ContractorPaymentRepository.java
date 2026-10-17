package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Every "paid" query below is OUT-only (money we paid the contractor), so the existing reports,
 * cash flow and project cost keep their meaning. Money received back is read through the
 * explicit {@code Received} queries.
 */
@Repository
public interface ContractorPaymentRepository extends JpaRepository<ContractorPayment, Long> {

    List<ContractorPayment> findByContractorIdOrderByPaymentDateDesc(Long contractorId);

    @Query("SELECT p FROM ContractorPayment p WHERE p.project.id = :projectId AND p.status = :status AND p.direction = 'OUT'")
    List<ContractorPayment> findByProjectIdAndStatus(@Param("projectId") Long projectId, @Param("status") String status);

    @Query("SELECT p FROM ContractorPayment p WHERE p.status = :status AND p.paymentDate BETWEEN :from AND :to AND p.direction = 'OUT'")
    List<ContractorPayment> findByStatusAndPaymentDateBetween(@Param("status") String status,
                                                              @Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Money contractors paid back to us in the window. */
    @Query("SELECT p FROM ContractorPayment p WHERE p.status = 'PAID' AND p.paymentDate BETWEEN :from AND :to " +
           "AND p.direction = 'IN' AND p.isDeleted = false")
    List<ContractorPayment> findReceivedBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    List<ContractorPayment> findByBillIdOrderByIdAsc(Long billId);
    List<ContractorPayment> findByWorkPackageIdOrderByIdDesc(Long workPackageId);
    List<ContractorPayment> findByStatusOrderByIdDesc(String status);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.contractor.id = :contractorId AND p.status = 'PAID' AND p.direction = 'OUT' AND p.isDeleted = false")
    BigDecimal sumPaidByContractor(@Param("contractorId") Long contractorId);

    /** Money this contractor has paid back to us. */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.contractor.id = :contractorId AND p.status = 'PAID' AND p.direction = 'IN' AND p.isDeleted = false")
    BigDecimal sumReceivedFromContractor(@Param("contractorId") Long contractorId);

    /** Advances paid out; the billing service sets these off against running bills. */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.contractor.id = :contractorId AND p.paymentType = 'ADVANCE' AND p.direction = 'OUT' " +
           "AND p.status = 'PAID' AND p.isDeleted = false")
    BigDecimal sumAdvancesByContractor(@Param("contractorId") Long contractorId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.workPackage.id = :workPackageId AND p.status = 'PAID' AND p.direction = 'OUT' AND p.isDeleted = false")
    BigDecimal sumPaidByWorkPackage(@Param("workPackageId") Long workPackageId);

    /** Actual cash disbursed to contractors on a project (cash-basis cost). */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.project.id = :projectId AND p.status = 'PAID' AND p.direction = 'OUT' AND p.isDeleted = false")
    BigDecimal sumPaidForProject(@Param("projectId") Long projectId);

    /** Cash contractors returned to us on a project — nets against the cash cost above. */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.project.id = :projectId AND p.status = 'PAID' AND p.direction = 'IN' AND p.isDeleted = false")
    BigDecimal sumReceivedForProject(@Param("projectId") Long projectId);
}

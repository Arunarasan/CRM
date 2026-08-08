package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface ContractorPaymentRepository extends JpaRepository<ContractorPayment, Long> {

    List<ContractorPayment> findByContractorIdOrderByPaymentDateDesc(Long contractorId);
    List<ContractorPayment> findByProjectIdAndStatus(Long projectId, String status);
    List<ContractorPayment> findByStatusAndPaymentDateBetween(String status, java.time.LocalDate from, java.time.LocalDate to);

    List<ContractorPayment> findByBillIdOrderByIdAsc(Long billId);
    List<ContractorPayment> findByWorkPackageIdOrderByIdDesc(Long workPackageId);
    List<ContractorPayment> findByStatusOrderByIdDesc(String status);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.contractor.id = :contractorId AND p.status = 'PAID' AND p.isDeleted = false")
    BigDecimal sumPaidByContractor(@Param("contractorId") Long contractorId);

    /** Advances paid out; the billing service sets these off against running bills. */
    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.contractor.id = :contractorId AND p.paymentType = 'ADVANCE' " +
           "AND p.status = 'PAID' AND p.isDeleted = false")
    BigDecimal sumAdvancesByContractor(@Param("contractorId") Long contractorId);

    @Query("SELECT COALESCE(SUM(p.amount), 0) FROM ContractorPayment p " +
           "WHERE p.workPackage.id = :workPackageId AND p.status = 'PAID' AND p.isDeleted = false")
    BigDecimal sumPaidByWorkPackage(@Param("workPackageId") Long workPackageId);
}

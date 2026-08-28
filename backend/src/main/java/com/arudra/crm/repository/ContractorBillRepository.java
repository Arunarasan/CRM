package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorBill;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ContractorBillRepository extends JpaRepository<ContractorBill, Long> {

    List<ContractorBill> findByContractorIdOrderByIdDesc(Long contractorId);

    List<ContractorBill> findByWorkPackageIdOrderByIdDesc(Long workPackageId);

    List<ContractorBill> findByProjectIdOrderByIdDesc(Long projectId);

    boolean existsByBillNumber(String billNumber);

    @Query("SELECT b FROM ContractorBill b WHERE " +
           "(:contractorId IS NULL OR b.contractor.id = :contractorId) " +
           "AND (:projectId IS NULL OR b.project.id = :projectId) " +
           "AND (:workPackageId IS NULL OR b.workPackage.id = :workPackageId) " +
           "AND (:status IS NULL OR b.status = :status) " +
           "AND (:billType IS NULL OR b.billType = :billType) " +
           "AND (:from IS NULL OR b.billDate >= :from) " +
           "AND (:to IS NULL OR b.billDate <= :to) " +
           "AND b.isDeleted = false")
    Page<ContractorBill> search(@Param("contractorId") Long contractorId,
                                @Param("projectId") Long projectId,
                                @Param("workPackageId") Long workPackageId,
                                @Param("status") String status,
                                @Param("billType") String billType,
                                @Param("from") LocalDate from,
                                @Param("to") LocalDate to,
                                Pageable pageable);

    /** Bills that cleared approval but still carry a balance — the payment queue. */
    @Query("SELECT b FROM ContractorBill b WHERE b.status IN ('FINANCE_APPROVED', 'PARTIALLY_PAID') " +
           "AND b.balanceAmount > 0 AND b.isDeleted = false ORDER BY b.billDate ASC")
    List<ContractorBill> findPayable();

    @Query("SELECT b FROM ContractorBill b WHERE b.status IN " +
           "('SUBMITTED', 'ENGINEER_APPROVED', 'PM_APPROVED') AND b.isDeleted = false ORDER BY b.billDate ASC")
    List<ContractorBill> findPendingApproval();

    @Query("SELECT COALESCE(SUM(b.netAmount), 0) FROM ContractorBill b " +
           "WHERE b.workPackage.id = :workPackageId AND b.status NOT IN ('REJECTED', 'CANCELLED', 'DRAFT') " +
           "AND b.isDeleted = false")
    BigDecimal sumNetByWorkPackage(@Param("workPackageId") Long workPackageId);

    @Query("SELECT COALESCE(SUM(b.balanceAmount), 0) FROM ContractorBill b " +
           "WHERE b.contractor.id = :contractorId AND b.status NOT IN ('REJECTED', 'CANCELLED', 'DRAFT') " +
           "AND b.isDeleted = false")
    BigDecimal sumOutstandingByContractor(@Param("contractorId") Long contractorId);

    /** Global contractor outstanding across all contractors (finance dashboard). */
    @Query("SELECT COALESCE(SUM(b.balanceAmount), 0) FROM ContractorBill b " +
           "WHERE b.status NOT IN ('REJECTED', 'CANCELLED', 'DRAFT') AND b.isDeleted = false")
    BigDecimal sumAllOutstanding();

    /** Outstanding balance on bills dated within a period — the month-scoped contractor payable. */
    @Query("SELECT COALESCE(SUM(b.balanceAmount), 0) FROM ContractorBill b " +
           "WHERE b.billDate BETWEEN :from AND :to AND b.status NOT IN ('REJECTED', 'CANCELLED', 'DRAFT') " +
           "AND b.isDeleted = false")
    BigDecimal sumOutstandingBetween(@org.springframework.data.repository.query.Param("from") java.time.LocalDate from,
                                     @org.springframework.data.repository.query.Param("to") java.time.LocalDate to);

    @Query("SELECT COALESCE(SUM(b.retentionAmount), 0) FROM ContractorBill b " +
           "WHERE b.contractor.id = :contractorId AND b.status NOT IN ('REJECTED', 'CANCELLED', 'DRAFT') " +
           "AND b.isDeleted = false")
    BigDecimal sumRetentionByContractor(@Param("contractorId") Long contractorId);

    /** Quantity already billed for a work package item across earlier running bills. */
    @Query("SELECT COALESCE(SUM(i.quantity), 0) FROM ContractorBillItem i " +
           "WHERE i.workPackageItem.id = :itemId AND i.bill.status NOT IN ('REJECTED', 'CANCELLED') " +
           "AND i.isDeleted = false")
    BigDecimal sumBilledQuantityForItem(@Param("itemId") Long itemId);
}

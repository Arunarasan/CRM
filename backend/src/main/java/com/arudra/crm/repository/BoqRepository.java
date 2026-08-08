package com.arudra.crm.repository;

import com.arudra.crm.entity.Boq;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface BoqRepository extends JpaRepository<Boq, Long>, JpaSpecificationExecutor<Boq> {

    /** Latest BOQ-xxxxxx numbers for sequential number generation. */
    @Query("SELECT b.boqNumber FROM Boq b WHERE b.boqNumber LIKE 'BOQ-%' ORDER BY b.boqNumber DESC")
    List<String> findLatestBoqNumbers(Pageable pageable);

    List<Boq> findByCustomerIdAndIsDeletedFalseOrderByIdDesc(Long customerId);

    Page<Boq> findByCustomerIdAndIsDeletedFalse(Long customerId, Pageable pageable);

    List<Boq> findByProjectIdAndIsDeletedFalseOrderByIdDesc(Long projectId);

    List<Boq> findByMeasurementIdAndIsDeletedFalseOrderByIdDesc(Long measurementId);

    List<Boq> findByLeadIdAndIsDeletedFalseOrderByIdDesc(Long leadId);

    /**
     * The root/Master BOQ row(s) for a Measurement — used to enforce one Master BOQ per Measurement.
     * Returns a List rather than Optional: legacy data predating this rule may already have more than
     * one root BOQ for the same measurement, and a derived Optional query would throw on that instead
     * of letting the caller decide how to handle it.
     */
    List<Boq> findByMeasurementIdAndParentBoqIdIsNullAndIsDeletedFalse(Long measurementId);

    List<Boq> findByParentBoqIdAndIsDeletedFalseOrderByRevisionNumberDesc(Long parentBoqId);

    long countByStatus(String status);

    @Query("SELECT SUM(b.grandTotal) FROM Boq b WHERE b.isLatestVersion = true AND b.status <> 'REJECTED'")
    BigDecimal sumTotalBoqValue();

    long countByIsLatestVersionTrue();
}

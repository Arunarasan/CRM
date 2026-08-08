package com.arudra.crm.repository;

import com.arudra.crm.entity.Measurement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface MeasurementRepository extends JpaRepository<Measurement, Long>, JpaSpecificationExecutor<Measurement> {
    List<Measurement> findByLeadId(Long leadId);
    List<Measurement> findByCustomerId(Long customerId);
    Page<Measurement> findByCustomerId(Long customerId, Pageable pageable);
    List<Measurement> findByProjectId(Long projectId);
    Measurement findByMeasurementNumber(String measurementNumber);

    long countByMeasurementDateAndLeadIsNotNull(java.time.LocalDate date);

    /** Latest MS-xxxxxx numbers for sequential number generation; legacy MSR-/random numbers are excluded by the prefix filter. */
    @Query("SELECT m.measurementNumber FROM Measurement m WHERE m.measurementNumber LIKE 'MS-%' ORDER BY m.measurementNumber DESC")
    List<String> findLatestMeasurementNumbers(Pageable pageable);

    long countByIsDeletedFalseAndMeasurementDate(LocalDate date);

    long countByIsDeletedFalseAndStatus(String status);

    long countByIsDeletedFalseAndStatusIn(List<String> statuses);

    long countByIsDeletedFalseAndMeasurementDateBetween(LocalDate from, LocalDate to);

    List<Measurement> findByCustomerIdAndIsDeletedFalseOrderByIdDesc(Long customerId);

    List<Measurement> findByProjectIdAndIsDeletedFalseOrderByIdDesc(Long projectId);

    List<Measurement> findByParentMeasurementIdOrderByRevisionNumberDesc(Long parentId);
}

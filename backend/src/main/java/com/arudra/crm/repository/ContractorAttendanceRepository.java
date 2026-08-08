package com.arudra.crm.repository;

import com.arudra.crm.entity.ContractorAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ContractorAttendanceRepository extends JpaRepository<ContractorAttendance, Long> {

    List<ContractorAttendance> findByContractorIdOrderByDateDesc(Long contractorId);

    List<ContractorAttendance> findByWorkPackageIdOrderByDateDesc(Long workPackageId);

    List<ContractorAttendance> findByProjectIdAndDateOrderByIdAsc(Long projectId, LocalDate date);

    /** One attendance row per contractor per package per day — repeats update the existing row. */
    Optional<ContractorAttendance> findFirstByContractorIdAndWorkPackageIdAndDate(
            Long contractorId, Long workPackageId, LocalDate date);

    @Query("SELECT a FROM ContractorAttendance a WHERE a.contractor.id = :contractorId " +
           "AND a.date BETWEEN :from AND :to AND a.isDeleted = false ORDER BY a.date DESC")
    List<ContractorAttendance> findForContractorBetween(@Param("contractorId") Long contractorId,
                                                        @Param("from") LocalDate from,
                                                        @Param("to") LocalDate to);

    @Query("SELECT COALESCE(SUM(a.workersCount), 0) FROM ContractorAttendance a " +
           "WHERE a.date = :date AND a.status = 'PRESENT' AND a.isDeleted = false")
    Long totalWorkersOn(@Param("date") LocalDate date);
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.WorkPackageAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkPackageAssignmentRepository extends JpaRepository<WorkPackageAssignment, Long> {

    List<WorkPackageAssignment> findByWorkPackageIdOrderByIdAsc(Long workPackageId);

    List<WorkPackageAssignment> findByContractorIdOrderByIdDesc(Long contractorId);

    Optional<WorkPackageAssignment> findFirstByWorkPackageIdAndContractorId(Long workPackageId, Long contractorId);

    List<WorkPackageAssignment> findByContractorIdAndStatus(Long contractorId, String status);

    @Query("SELECT a FROM WorkPackageAssignment a WHERE a.workPackage.id IN :packageIds AND a.isDeleted = false")
    List<WorkPackageAssignment> findByWorkPackageIds(@Param("packageIds") List<Long> packageIds);

    @Query("SELECT COUNT(DISTINCT a.contractor.id) FROM WorkPackageAssignment a " +
           "WHERE a.status IN ('ACCEPTED', 'IN_PROGRESS') AND a.isDeleted = false")
    long countActiveContractors();
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.WorkPackageChange;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkPackageChangeRepository extends JpaRepository<WorkPackageChange, Long> {
    List<WorkPackageChange> findByWorkPackageIdOrderByIdDesc(Long workPackageId);
    List<WorkPackageChange> findByStatusOrderByIdDesc(String status);
    List<WorkPackageChange> findByProjectChangeRequestId(Long projectChangeRequestId);
    boolean existsByChangeNumber(String changeNumber);
}

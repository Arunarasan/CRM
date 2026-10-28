package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeCelebration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeCelebrationRepository extends JpaRepository<EmployeeCelebration, Long> {

    List<EmployeeCelebration> findByEmployeeIdAndIsDeletedFalseOrderByRewardDateDescIdDesc(Long employeeId);

    Optional<EmployeeCelebration> findByIdAndEmployeeIdAndIsDeletedFalse(Long id, Long employeeId);

    boolean existsByEmployeeIdAndSourceTypeAndSourceId(Long employeeId, String sourceType, Long sourceId);

    List<EmployeeCelebration> findByEmployeeIdAndOpenedFalseAndIsDeletedFalse(Long employeeId);
}

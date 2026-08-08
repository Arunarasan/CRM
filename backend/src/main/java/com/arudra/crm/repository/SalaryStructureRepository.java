package com.arudra.crm.repository;

import com.arudra.crm.entity.SalaryStructure;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SalaryStructureRepository extends JpaRepository<SalaryStructure, Long> {
    Optional<SalaryStructure> findFirstByEmployeeIdAndActiveTrueOrderByIdDesc(Long employeeId);
}

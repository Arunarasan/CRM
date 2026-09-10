package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeWebauthnCredential;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeWebauthnCredentialRepository extends JpaRepository<EmployeeWebauthnCredential, Long> {

    List<EmployeeWebauthnCredential> findByEmployeeIdAndIsDeletedFalse(Long employeeId);

    Optional<EmployeeWebauthnCredential> findByCredentialIdAndIsDeletedFalse(String credentialId);

    boolean existsByEmployeeIdAndIsDeletedFalse(Long employeeId);
}

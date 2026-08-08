package com.arudra.crm.repository;

import com.arudra.crm.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    Page<Employee> findAllByOrderByFirstNameAsc(Pageable pageable);
    List<Employee> findByDepartmentId(Long departmentId);
    java.util.Optional<Employee> findByWorkforceId(Long workforceId);
    List<Employee> findByPayrollEnabledTrueAndIsDeletedFalse();

    /** Links a signed-in {@link com.arudra.crm.entity.User} to its master employee record by shared email. */
    java.util.Optional<Employee> findByEmailIgnoreCaseAndIsDeletedFalse(String email);
}

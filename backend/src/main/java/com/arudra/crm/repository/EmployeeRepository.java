package com.arudra.crm.repository;

import com.arudra.crm.entity.Employee;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {
    long countByStatusAndIsDeletedFalse(String status);
    Page<Employee> findAllByOrderByFirstNameAsc(Pageable pageable);
    List<Employee> findByDepartmentId(Long departmentId);
    List<Employee> findByPhoneIsNotNullAndIsDeletedFalse();
    java.util.Optional<Employee> findByWorkforceId(Long workforceId);
    List<Employee> findByPayrollEnabledTrueAndIsDeletedFalse();

    /** Legacy e-mail match; used only to link/relink, never to resolve a signed-in user. */
    java.util.Optional<Employee> findByEmailIgnoreCaseAndIsDeletedFalse(String email);


    /** The employee a signed-in user is linked to (explicit users.id link, not an e-mail match). */
    java.util.Optional<Employee> findByUserIdAndIsDeletedFalse(Long userId);
    java.util.Optional<Employee> findByUserId(Long userId);
    List<Employee> findByUserIdIsNotNull();

    /** Resolves an employee from the token behind their personal review QR code. */
    java.util.Optional<Employee> findByReviewTokenAndIsDeletedFalse(String reviewToken);

    /** Employees who have a pending self-service attendance-method switch awaiting admin approval. */
    List<Employee> findByAttendanceMethodRequestedIsNotNullAndIsDeletedFalse();
}

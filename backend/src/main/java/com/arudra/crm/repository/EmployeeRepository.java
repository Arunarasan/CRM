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

    /** Resolves an employee from the token behind their personal review QR code. */
    java.util.Optional<Employee> findByReviewTokenAndIsDeletedFalse(String reviewToken);

    /** Employees who have a pending self-service attendance-method switch awaiting admin approval. */
    List<Employee> findByAttendanceMethodRequestedIsNotNullAndIsDeletedFalse();

    /** Serialises concurrent punches for one employee (terminal + offline sync racing each other). */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from Employee e where e.id = :id")
    java.util.Optional<Employee> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    java.util.Optional<Employee> findFirstByEmployeeCodeIgnoreCaseAndIsDeletedFalse(String employeeCode);

    /** Active (non-terminated, non-deleted) employees, for the attendance dashboard and terminal lookups. */
    @org.springframework.data.jpa.repository.Query("select e from Employee e where e.isDeleted = false "
            + "and (e.status is null or e.status <> 'TERMINATED') order by e.firstName, e.lastName")
    List<Employee> findActiveForAttendance();
}

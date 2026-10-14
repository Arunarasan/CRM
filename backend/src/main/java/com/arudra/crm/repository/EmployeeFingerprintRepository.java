package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeFingerprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeFingerprintRepository extends JpaRepository<EmployeeFingerprint, Long> {

    List<EmployeeFingerprint> findByEmployeeIdOrderByFingerAscSampleNoAsc(Long employeeId);

    /** All templates of active (non-deleted) employees, for kiosk matching. */
    @Query("select f from EmployeeFingerprint f join fetch f.employee e where e.isDeleted = false")
    List<EmployeeFingerprint> findAllActive();

    /** Everyone else's templates, for the "this finger already belongs to someone" check. */
    @Query("select f from EmployeeFingerprint f join fetch f.employee e where e.id <> :employeeId")
    List<EmployeeFingerprint> findAllExcept(Long employeeId);

    /** Biometric data is removed for real, not flagged deleted. */
    @Modifying
    @Query("delete from EmployeeFingerprint f where f.employee.id = :employeeId")
    int deleteAllForEmployee(Long employeeId);

    @Modifying
    @Query("delete from EmployeeFingerprint f where f.employee.id = :employeeId and f.finger = :finger")
    int deleteFinger(Long employeeId, Integer finger);

    /** employeeId, number of distinct fingers, latest enrolment time: one row per enrolled employee. */
    @Query("select f.employee.id, count(distinct f.finger), max(f.createdAt) from EmployeeFingerprint f group by f.employee.id")
    List<Object[]> summary();
}

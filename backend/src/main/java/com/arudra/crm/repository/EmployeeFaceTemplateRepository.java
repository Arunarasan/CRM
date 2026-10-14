package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeFaceTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EmployeeFaceTemplateRepository extends JpaRepository<EmployeeFaceTemplate, Long> {

    List<EmployeeFaceTemplate> findByEmployeeIdOrderBySampleNoAsc(Long employeeId);

    /** All templates of active (non-deleted) employees, for kiosk matching. */
    @Query("select t from EmployeeFaceTemplate t join fetch t.employee e where e.isDeleted = false")
    List<EmployeeFaceTemplate> findAllActive();

    /** Everyone else's templates, for the "looks like another employee" check. */
    @Query("select t from EmployeeFaceTemplate t where t.employee.id <> :employeeId")
    List<EmployeeFaceTemplate> findAllExcept(Long employeeId);

    /** Biometric data is removed for real, not flagged deleted. */
    @Modifying
    @Query("delete from EmployeeFaceTemplate t where t.employee.id = :employeeId")
    int deleteAllForEmployee(Long employeeId);

    /** employeeId, sample count, latest enrollment time — one row per enrolled employee. */
    @Query("select t.employee.id, count(t), max(t.createdAt) from EmployeeFaceTemplate t group by t.employee.id")
    List<Object[]> summary();
}

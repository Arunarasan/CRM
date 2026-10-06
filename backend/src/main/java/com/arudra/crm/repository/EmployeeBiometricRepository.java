package com.arudra.crm.repository;

import com.arudra.crm.entity.EmployeeBiometric;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface EmployeeBiometricRepository extends JpaRepository<EmployeeBiometric, Long> {
    List<EmployeeBiometric> findByEmployeeIdAndIsDeletedFalseOrderByIdDesc(Long employeeId);

    List<EmployeeBiometric> findByEmployeeIdAndStatusAndIsDeletedFalse(Long employeeId, String status);

    List<EmployeeBiometric> findByDeviceIdAndStatusAndIsDeletedFalse(Long deviceId, String status);

    boolean existsByEmployeeIdAndStatusAndIsDeletedFalse(Long employeeId, String status);

    @Query("select distinct b.employee.id from EmployeeBiometric b where b.status = 'ACTIVE' and b.isDeleted = false "
            + "and b.employee.id in :employeeIds")
    List<Long> findEnrolledEmployeeIds(Collection<Long> employeeIds);

    @Query("select count(b) from EmployeeBiometric b where b.device.id = :deviceId and b.status = 'ACTIVE' and b.isDeleted = false")
    long countActiveOnDevice(Long deviceId);
}

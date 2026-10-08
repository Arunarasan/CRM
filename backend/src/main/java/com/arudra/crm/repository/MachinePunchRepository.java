package com.arudra.crm.repository;

import com.arudra.crm.entity.MachinePunch;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface MachinePunchRepository extends JpaRepository<MachinePunch, Long> {

    boolean existsByMachineIdAndMachinePinAndPunchTime(Long machineId, String machinePin, LocalDateTime punchTime);

    /** An employee's punches in a window (a day, plus slack for night shifts), oldest first. */
    List<MachinePunch> findByEmployeeIdAndPunchTimeBetweenOrderByPunchTimeAsc(Long employeeId, LocalDateTime from, LocalDateTime to);

    /** Punches whose PIN isn't linked to an employee yet. */
    List<MachinePunch> findByEmployeeIsNullAndMachinePinOrderByPunchTimeAsc(String machinePin);

    /** Unmatched PINs with punch count and first/last seen — for HR to link to an employee. */
    @Query("select p.machinePin, count(p), min(p.punchTime), max(p.punchTime) from MachinePunch p "
            + "where p.employee is null group by p.machinePin order by max(p.punchTime) desc")
    List<Object[]> summarizeUnmatched();

    @Query("select p from MachinePunch p where (:machineId is null or p.machine.id = :machineId) "
            + "and (:employeeId is null or p.employee.id = :employeeId) "
            + "and p.punchTime between :from and :to order by p.punchTime desc")
    List<MachinePunch> search(@Param("machineId") Long machineId, @Param("employeeId") Long employeeId,
                              @Param("from") LocalDateTime from, @Param("to") LocalDateTime to, Pageable page);

    long countByMachineIdAndPunchTimeAfter(Long machineId, LocalDateTime after);

    /** Unlinks punches from sessions about to be rebuilt (the FK would otherwise block the delete). */
    @Modifying
    @Query("update MachinePunch p set p.session = null where p.session.id in :sessionIds")
    int clearSessionLinks(@Param("sessionIds") java.util.Collection<Long> sessionIds);
}

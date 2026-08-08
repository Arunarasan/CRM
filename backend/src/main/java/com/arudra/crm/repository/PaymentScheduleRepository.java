package com.arudra.crm.repository;

import com.arudra.crm.entity.PaymentSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface PaymentScheduleRepository extends JpaRepository<PaymentSchedule, Long> {
    List<PaymentSchedule> findByProjectIdAndIsDeletedFalseOrderBySortOrderAscIdAsc(Long projectId);
    List<PaymentSchedule> findByStatusInAndDueDateBetweenAndIsDeletedFalse(List<String> statuses, LocalDate from, LocalDate to);
    List<PaymentSchedule> findByStatusInAndDueDateBeforeAndIsDeletedFalse(List<String> statuses, LocalDate date);
}

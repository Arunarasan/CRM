package com.arudra.crm.repository;

import com.arudra.crm.entity.DailyReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DailyReportRepository extends JpaRepository<DailyReport, Long> {
    List<DailyReport> findByEmployeeIdAndIsDeletedFalseOrderByReportDateDescIdDesc(Long userId);
}

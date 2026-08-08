package com.arudra.crm.repository;

import com.arudra.crm.entity.ActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findByEntityNameAndEntityIdOrderByPerformedAtDesc(String entityName, Long entityId);
    Page<ActivityLog> findByEntityNameAndEntityIdOrderByPerformedAtDesc(String entityName, Long entityId, Pageable pageable);
}

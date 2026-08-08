package com.arudra.crm.repository;

import com.arudra.crm.entity.AssignmentHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssignmentHistoryRepository extends JpaRepository<AssignmentHistory, Long> {
    List<AssignmentHistory> findByTaskIdOrderByCreatedAtDesc(Long taskId);
    List<AssignmentHistory> findByResourceTypeAndResourceIdOrderByCreatedAtDesc(String resourceType, Long resourceId);
    List<AssignmentHistory> findAllByOrderByCreatedAtDesc();
    List<AssignmentHistory> findByTaskIdAndResourceTypeAndResourceIdAndStatus(
            Long taskId, String resourceType, Long resourceId, String status);
}

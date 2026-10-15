package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskCancelRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskCancelRequestRepository extends JpaRepository<TaskCancelRequest, Long> {
    List<TaskCancelRequest> findByStatusOrderByIdAsc(String status);
    Optional<TaskCancelRequest> findFirstByTaskIdAndStatus(Long taskId, String status);
    long countByStatus(String status);
}

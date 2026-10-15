package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskJoinRequestRepository extends JpaRepository<TaskJoinRequest, Long> {
    List<TaskJoinRequest> findByTaskIdAndStatus(Long taskId, String status);
    Optional<TaskJoinRequest> findFirstByTaskIdAndRequesterIdAndStatus(Long taskId, Long requesterId, String status);
}

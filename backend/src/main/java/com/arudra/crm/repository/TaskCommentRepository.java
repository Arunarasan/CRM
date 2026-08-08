package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {
    List<TaskComment> findByTaskIdOrderByCreatedAtDesc(Long taskId);
}

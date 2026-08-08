package com.arudra.crm.repository;

import com.arudra.crm.entity.TaskChecklistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskChecklistItemRepository extends JpaRepository<TaskChecklistItem, Long> {
    List<TaskChecklistItem> findByChecklistId(Long checklistId);
}

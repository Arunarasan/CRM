package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectRoomItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRoomItemRepository extends JpaRepository<ProjectRoomItem, Long> {
    List<ProjectRoomItem> findByRoomIdOrderByIdAsc(Long roomId);
    Optional<ProjectRoomItem> findByRoomIdAndBoqItemId(Long roomId, Long boqItemId);

    /** All work items in a project, walking Item -> Room -> Phase -> Project. Used by the progress dashboard. */
    List<ProjectRoomItem> findByRoomPhaseProjectId(Long projectId);
}

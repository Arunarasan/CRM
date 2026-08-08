package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectRoom;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectRoomRepository extends JpaRepository<ProjectRoom, Long> {
    List<ProjectRoom> findByPhaseIdOrderByIdAsc(Long phaseId);
    Optional<ProjectRoom> findByPhaseIdAndRoomName(Long phaseId, String roomName);
    List<ProjectRoom> findByPhaseProjectId(Long projectId);
}

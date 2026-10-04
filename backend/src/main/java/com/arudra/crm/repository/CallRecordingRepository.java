package com.arudra.crm.repository;

import com.arudra.crm.entity.CallRecording;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CallRecordingRepository extends JpaRepository<CallRecording, Long> {

    List<CallRecording> findByIsDeletedFalseOrderByIdDesc();

    Optional<CallRecording> findFirstByTaskIdAndIsDeletedFalse(Long taskId);

    List<CallRecording> findByLeadIdAndIsDeletedFalseOrderByIdDesc(Long leadId);
}

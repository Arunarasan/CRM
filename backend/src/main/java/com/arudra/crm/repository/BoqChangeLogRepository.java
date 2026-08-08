package com.arudra.crm.repository;

import com.arudra.crm.entity.BoqChangeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BoqChangeLogRepository extends JpaRepository<BoqChangeLog, Long> {
    List<BoqChangeLog> findByBoqIdOrderByModifiedDateDesc(Long boqId);
}

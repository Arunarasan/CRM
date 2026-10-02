package com.arudra.crm.repository;

import com.arudra.crm.entity.BoqChangeLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BoqChangeLogRepository extends JpaRepository<BoqChangeLog, Long> {
    List<BoqChangeLog> findByBoqIdOrderByModifiedDateDesc(Long boqId);

    /** Keeps the history rows of a deleted line (they still name the BOQ) but drops their link to it. */
    @Modifying
    @Query("update BoqChangeLog c set c.boqItem = null where c.boqItem.id = :itemId")
    int detachItem(@Param("itemId") Long itemId);
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.BoqPhase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BoqPhaseRepository extends JpaRepository<BoqPhase, Long> {
    List<BoqPhase> findByBoqIdOrderBySequenceAsc(Long boqId);
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.ManpowerRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ManpowerRequestRepository extends JpaRepository<ManpowerRequest, Long> {
    List<ManpowerRequest> findByRequestedByIdAndIsDeletedFalseOrderByIdDesc(Long userId);
}

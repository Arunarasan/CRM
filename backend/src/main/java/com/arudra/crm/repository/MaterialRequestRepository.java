package com.arudra.crm.repository;

import com.arudra.crm.entity.MaterialRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialRequestRepository extends JpaRepository<MaterialRequest, Long> {
    List<MaterialRequest> findAllByOrderByIdDesc();
    List<MaterialRequest> findByRequestedByIdOrderByIdDesc(Long userId);
    List<MaterialRequest> findByStatusOrderByIdDesc(String status);
}

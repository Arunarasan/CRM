package com.arudra.crm.repository;

import com.arudra.crm.entity.MaterialRequestItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialRequestItemRepository extends JpaRepository<MaterialRequestItem, Long> {
    List<MaterialRequestItem> findByRequestId(Long requestId);
}

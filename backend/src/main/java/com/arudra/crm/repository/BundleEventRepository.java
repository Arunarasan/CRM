package com.arudra.crm.repository;

import com.arudra.crm.entity.BundleEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BundleEventRepository extends JpaRepository<BundleEvent, Long> {

    List<BundleEvent> findByBundleIdAndIsDeletedFalseOrderByCreatedAtAsc(Long bundleId);
}

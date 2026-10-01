package com.arudra.crm.repository;

import com.arudra.crm.entity.BundleItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;

@Repository
public interface BundleItemRepository extends JpaRepository<BundleItem, Long> {

    List<BundleItem> findByBundleIdAndIsDeletedFalseOrderByIdAsc(Long bundleId);

    List<BundleItem> findByBundleIdInAndIsDeletedFalse(Collection<Long> bundleIds);
}

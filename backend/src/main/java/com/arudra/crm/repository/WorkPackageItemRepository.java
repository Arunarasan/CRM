package com.arudra.crm.repository;

import com.arudra.crm.entity.WorkPackageItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkPackageItemRepository extends JpaRepository<WorkPackageItem, Long> {

    List<WorkPackageItem> findByWorkPackageIdOrderByIdAsc(Long workPackageId);

    Optional<WorkPackageItem> findFirstByWorkPackageIdAndBoqItemId(Long workPackageId, Long boqItemId);

    /** Guards double-allocation: a BOQ item may only sit in one live work package. */
    @Query("SELECT i FROM WorkPackageItem i WHERE i.boqItem.id = :boqItemId AND i.isDeleted = false " +
           "AND i.workPackage.status <> 'CANCELLED'")
    List<WorkPackageItem> findLiveAllocationsForBoqItem(@Param("boqItemId") Long boqItemId);

    @Query("SELECT COALESCE(SUM(i.amount), 0) FROM WorkPackageItem i " +
           "WHERE i.workPackage.id = :workPackageId AND i.isDeleted = false")
    java.math.BigDecimal sumAmountByWorkPackage(@Param("workPackageId") Long workPackageId);
}

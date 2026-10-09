package com.arudra.crm.repository;

import com.arudra.crm.entity.Refund;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Repository
public interface RefundRepository extends JpaRepository<Refund, Long> {
    Page<Refund> findByIsDeletedFalseOrderByIdDesc(Pageable pageable);
    List<Refund> findByStatusAndIsDeletedFalseOrderByIdDesc(String status);
    List<Refund> findByCustomerIdAndIsDeletedFalseOrderByIdDesc(Long customerId);
    Optional<Refund> findTopByOrderByIdDesc();
    List<Refund> findByProjectIdAndIsDeletedFalseOrderByIdDesc(Long projectId);

    /** Refunds for a project in the given statuses (e.g. not REJECTED = committed, PAID = money out). */
    @Query("select coalesce(sum(r.amount), 0) from Refund r " +
           "where r.project.id = :projectId and r.status in :statuses and r.isDeleted = false")
    BigDecimal sumForProject(@Param("projectId") Long projectId, @Param("statuses") java.util.Collection<String> statuses);
}

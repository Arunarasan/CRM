package com.arudra.crm.repository;

import com.arudra.crm.entity.PurchaseOrder;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {
    Page<PurchaseOrder> findAllByOrderByDateDesc(Pageable pageable);

    boolean existsByPoNumber(String poNumber);

    List<PurchaseOrder> findBySupplierId(Long supplierId);

    List<PurchaseOrder> findBySupplierIdOrderByIdDesc(Long supplierId);

    List<PurchaseOrder> findByProjectIdOrderByIdDesc(Long projectId);

    long countByStatusIn(List<String> statuses);

    List<PurchaseOrder> findByStatusIn(List<String> statuses);

    List<PurchaseOrder> findByExpectedDeliveryDateAndStatusIn(LocalDate expectedDeliveryDate, List<String> statuses);

    List<PurchaseOrder> findByExpectedDeliveryDateBeforeAndStatusIn(LocalDate date, List<String> statuses);

    List<PurchaseOrder> findAll(org.springframework.data.domain.Sort sort);

    @Query("SELECT po FROM PurchaseOrder po LEFT JOIN po.supplier s LEFT JOIN po.project p LEFT JOIN po.warehouse w WHERE " +
           "(:status IS NULL OR po.status = :status) AND " +
           "(:supplierId IS NULL OR s.id = :supplierId) AND " +
           "(:projectId IS NULL OR p.id = :projectId) AND " +
           "(:warehouseId IS NULL OR w.id = :warehouseId) AND " +
           "(:from IS NULL OR po.date >= :from) AND " +
           "(:to IS NULL OR po.date <= :to) AND " +
           "(:search IS NULL OR LOWER(po.poNumber) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "  OR LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY po.id DESC")
    Page<PurchaseOrder> search(@Param("status") String status,
                               @Param("supplierId") Long supplierId,
                               @Param("projectId") Long projectId,
                               @Param("warehouseId") Long warehouseId,
                               @Param("from") LocalDate from,
                               @Param("to") LocalDate to,
                               @Param("search") String search,
                               Pageable pageable);
}

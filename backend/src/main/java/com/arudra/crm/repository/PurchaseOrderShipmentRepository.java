package com.arudra.crm.repository;

import com.arudra.crm.entity.PurchaseOrderShipment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PurchaseOrderShipmentRepository extends JpaRepository<PurchaseOrderShipment, Long> {
    List<PurchaseOrderShipment> findByPurchaseOrderIdAndIsDeletedFalseOrderByIdAsc(Long purchaseOrderId);

    /** Shipments with this shipping ID (case-insensitive) on the given project's purchase orders. */
    @Query("SELECT s FROM PurchaseOrderShipment s WHERE s.isDeleted = false " +
           "AND LOWER(s.shippingId) = LOWER(:shippingId) AND s.purchaseOrder.project.id = :projectId")
    List<PurchaseOrderShipment> findForProject(@Param("shippingId") String shippingId, @Param("projectId") Long projectId);

    @Query("SELECT s FROM PurchaseOrderShipment s WHERE s.isDeleted = false " +
           "AND LOWER(s.shippingId) = LOWER(:shippingId) AND s.purchaseOrder.id = :poId")
    List<PurchaseOrderShipment> findOnOrder(@Param("shippingId") String shippingId, @Param("poId") Long poId);
}

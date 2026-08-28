package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementItemCatalog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementItemCatalogRepository extends JpaRepository<MeasurementItemCatalog, Long> {
    List<MeasurementItemCatalog> findByIsDeletedFalseOrderByOrderIndexAscNameAsc();
    List<MeasurementItemCatalog> findByActiveTrueAndIsDeletedFalseOrderByOrderIndexAscNameAsc();
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementFurniture;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementFurnitureRepository extends JpaRepository<MeasurementFurniture, Long> {
    List<MeasurementFurniture> findByMeasurementRoomId(Long roomId);
}

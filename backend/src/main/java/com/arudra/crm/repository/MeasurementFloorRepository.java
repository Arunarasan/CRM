package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementFloor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementFloorRepository extends JpaRepository<MeasurementFloor, Long> {
    List<MeasurementFloor> findByMeasurementRoomId(Long roomId);
}

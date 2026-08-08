package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementElectrical;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementElectricalRepository extends JpaRepository<MeasurementElectrical, Long> {
    List<MeasurementElectrical> findByMeasurementRoomId(Long roomId);
}

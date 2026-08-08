package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementPlumbing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementPlumbingRepository extends JpaRepository<MeasurementPlumbing, Long> {
    List<MeasurementPlumbing> findByMeasurementRoomId(Long roomId);
}

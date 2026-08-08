package com.arudra.crm.repository;

import com.arudra.crm.entity.MeasurementItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeasurementItemRepository extends JpaRepository<MeasurementItem, Long> {

    List<MeasurementItem> findByRoomId(Long roomId);

    @Query("SELECT i FROM MeasurementItem i WHERE i.room.measurement.id = :measurementId")
    List<MeasurementItem> findByMeasurementId(Long measurementId);
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.BoqItemLabour;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BoqItemLabourRepository extends JpaRepository<BoqItemLabour, Long> {
    List<BoqItemLabour> findByItemId(Long itemId);

    List<BoqItemLabour> findByItemBoqId(Long boqId);
}

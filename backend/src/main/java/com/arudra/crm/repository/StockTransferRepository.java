package com.arudra.crm.repository;

import com.arudra.crm.entity.StockTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockTransferRepository extends JpaRepository<StockTransfer, Long> {
    List<StockTransfer> findAllByOrderByIdDesc();
    List<StockTransfer> findByStatusOrderByIdDesc(String status);
}

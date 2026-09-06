package com.arudra.crm.repository;

import com.arudra.crm.entity.SalesReturn;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SalesReturnRepository extends JpaRepository<SalesReturn, Long> {
    Page<SalesReturn> findByIsDeletedFalseOrderByIdDesc(Pageable pageable);
}

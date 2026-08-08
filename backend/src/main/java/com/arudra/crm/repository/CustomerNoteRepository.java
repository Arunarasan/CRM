package com.arudra.crm.repository;

import com.arudra.crm.entity.CustomerNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomerNoteRepository extends JpaRepository<CustomerNote, Long> {
    List<CustomerNote> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
}

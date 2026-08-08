package com.arudra.crm.repository;

import com.arudra.crm.entity.CustomerDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CustomerDocumentRepository extends JpaRepository<CustomerDocument, Long> {
    List<CustomerDocument> findByCustomerIdOrderByCreatedAtDesc(Long customerId);
    Page<CustomerDocument> findByCustomerIdOrderByCreatedAtDesc(Long customerId, Pageable pageable);
}

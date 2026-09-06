package com.arudra.crm.repository;

import com.arudra.crm.entity.WebsiteEnquiry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface WebsiteEnquiryRepository extends JpaRepository<WebsiteEnquiry, Long> {

    List<WebsiteEnquiry> findByIsDeletedFalseOrderByCreatedAtDesc();

    List<WebsiteEnquiry> findByStatusAndIsDeletedFalseOrderByCreatedAtDesc(String status);
}

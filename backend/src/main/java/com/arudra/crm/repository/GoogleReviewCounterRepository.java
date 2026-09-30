package com.arudra.crm.repository;

import com.arudra.crm.entity.GoogleReviewCounter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GoogleReviewCounterRepository extends JpaRepository<GoogleReviewCounter, Long> {
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.Service;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ServiceRepository extends JpaRepository<Service, Long> {
    Optional<Service> findBySlugAndIsDeletedFalse(String slug);
    List<Service> findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc();

    // ---- Admin (CMS) ----
    List<Service> findByIsDeletedFalseOrderByDisplayOrderAsc();
    Optional<Service> findByIdAndIsDeletedFalse(Long id);
    boolean existsBySlugAndIsDeletedFalse(String slug);
}

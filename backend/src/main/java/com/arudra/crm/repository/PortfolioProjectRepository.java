package com.arudra.crm.repository;

import com.arudra.crm.entity.PortfolioProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PortfolioProjectRepository extends JpaRepository<PortfolioProject, Long> {
    Optional<PortfolioProject> findBySlugAndIsDeletedFalse(String slug);
    List<PortfolioProject> findByActiveTrueAndIsDeletedFalseOrderByDisplayOrderAsc();

    // ---- Admin (CMS) ----
    List<PortfolioProject> findByIsDeletedFalseOrderByDisplayOrderAsc();
    Optional<PortfolioProject> findByIdAndIsDeletedFalse(Long id);
    boolean existsBySlugAndIsDeletedFalse(String slug);
}

package com.arudra.crm.repository;

import com.arudra.crm.entity.Workforce;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkforceRepository extends JpaRepository<Workforce, Long> {

    List<Workforce> findByWorkforceTypeAndIsDeletedFalse(String workforceType);

    /**
     * Unified directory query. Every filter is optional (null = ignore). {@code skill} matches either
     * the primary or a comma-separated secondary skill. Department / company filters live on the
     * extension tables, so they are applied in {@code WorkforceService} after this base list, not here.
     */
    @Query("SELECT w FROM Workforce w WHERE w.isDeleted = false " +
           "AND (:type IS NULL OR w.workforceType = :type) " +
           "AND (:status IS NULL OR w.status = :status) " +
           "AND (:skill IS NULL OR w.primarySkill = :skill OR LOWER(w.secondarySkills) LIKE LOWER(CONCAT('%', :skill, '%'))) " +
           "AND (:search IS NULL OR LOWER(w.fullName) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "  OR LOWER(w.mobile) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "  OR LOWER(w.email) LIKE LOWER(CONCAT('%', :search, '%')) " +
           "  OR LOWER(w.primarySkill) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "ORDER BY w.fullName ASC")
    List<Workforce> filter(@Param("type") String type,
                           @Param("status") String status,
                           @Param("skill") String skill,
                           @Param("search") String search);
}

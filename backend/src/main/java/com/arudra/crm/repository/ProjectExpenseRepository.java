package com.arudra.crm.repository;

import com.arudra.crm.entity.ProjectExpense;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectExpenseRepository extends JpaRepository<ProjectExpense, Long> {

    List<ProjectExpense> findByProjectIdAndIsDeletedFalseOrderByExpenseDateDescIdDesc(Long projectId);

    Page<ProjectExpense> findByIsDeletedFalseOrderByExpenseDateDescIdDesc(Pageable pageable);

    Page<ProjectExpense> findByProjectIdAndIsDeletedFalseOrderByExpenseDateDescIdDesc(Long projectId, Pageable pageable);

    /** Idempotency key for auto-synced rows. */
    Optional<ProjectExpense> findBySourceAndReferenceIdAndIsDeletedFalse(String source, Long referenceId);

    @Query("select coalesce(sum(e.amount), 0) from ProjectExpense e " +
           "where e.project.id = :projectId and e.isDeleted = false")
    BigDecimal totalForProject(@Param("projectId") Long projectId);

    @Query("select e.category, coalesce(sum(e.amount), 0) from ProjectExpense e " +
           "where e.project.id = :projectId and e.isDeleted = false group by e.category")
    List<Object[]> totalsByCategoryForProject(@Param("projectId") Long projectId);

    @Query("select coalesce(sum(e.amount), 0) from ProjectExpense e " +
           "where e.expenseDate between :from and :to and e.isDeleted = false")
    BigDecimal totalBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("select e.category, coalesce(sum(e.amount), 0) from ProjectExpense e " +
           "where e.expenseDate between :from and :to and e.isDeleted = false group by e.category")
    List<Object[]> totalsByCategoryBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}

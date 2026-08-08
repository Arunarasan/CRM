package com.arudra.crm.repository;

import com.arudra.crm.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Repository
public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.date >= :startDate AND e.date <= :endDate")
    BigDecimal sumExpensesByDateRange(@Param("startDate") LocalDate startDate, @Param("endDate") LocalDate endDate);

    List<Expense> findByDateBetweenOrderByDateDesc(LocalDate startDate, LocalDate endDate);
}

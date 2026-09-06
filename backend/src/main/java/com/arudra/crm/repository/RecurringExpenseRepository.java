package com.arudra.crm.repository;

import com.arudra.crm.entity.RecurringExpense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RecurringExpenseRepository extends JpaRepository<RecurringExpense, Long> {

    List<RecurringExpense> findByIsDeletedFalseOrderByActiveDescNameAsc();

    List<RecurringExpense> findByActiveTrueAndIsDeletedFalseOrderByNameAsc();
}

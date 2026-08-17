package com.arudra.crm.controller;

import com.arudra.crm.entity.Expense;
import com.arudra.crm.repository.ExpenseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Company expenses are financial data — reads and writes are scoped to finance roles,
 * not every authenticated user.
 */
@RestController
@RequestMapping("/api/expenses")
@CrossOrigin(origins = "*")
public class ExpenseController {

    private static final String READ = "hasAuthority('ROLE_ADMIN') or hasAuthority('FINANCE_READ')";
    private static final String WRITE = "hasAuthority('ROLE_ADMIN') or hasAuthority('FINANCE_WRITE')";

    @Autowired
    private ExpenseRepository expenseRepository;

    @GetMapping
    @PreAuthorize(READ)
    public ResponseEntity<List<Expense>> getAllExpenses() {
        return ResponseEntity.ok(expenseRepository.findAll());
    }

    @PostMapping
    @PreAuthorize(WRITE)
    public ResponseEntity<Expense> createExpense(@RequestBody Expense expense) {
        return ResponseEntity.ok(expenseRepository.save(expense));
    }
}

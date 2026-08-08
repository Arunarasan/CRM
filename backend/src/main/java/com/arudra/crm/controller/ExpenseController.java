package com.arudra.crm.controller;

import com.arudra.crm.entity.Expense;
import com.arudra.crm.repository.ExpenseRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
@CrossOrigin(origins = "*")
public class ExpenseController {

    @Autowired
    private ExpenseRepository expenseRepository;

    @GetMapping
    public ResponseEntity<List<Expense>> getAllExpenses() {
        return ResponseEntity.ok(expenseRepository.findAll());
    }

    @PostMapping
    public ResponseEntity<Expense> createExpense(@RequestBody Expense expense) {
        return ResponseEntity.ok(expenseRepository.save(expense));
    }
}

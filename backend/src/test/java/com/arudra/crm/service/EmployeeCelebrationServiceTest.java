package com.arudra.crm.service;

import com.arudra.crm.entity.Employee;
import com.arudra.crm.entity.EmployeeCelebration;
import com.arudra.crm.repository.EmployeeCelebrationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class EmployeeCelebrationServiceTest {

    private EmployeeCelebrationRepository repo;
    private PayslipSettingsService settings;
    private PayslipSettingsService.Settings current;
    private EmployeeCelebrationService service;
    private final List<EmployeeCelebration> saved = new ArrayList<>();
    private Employee emp;

    @BeforeEach
    void setUp() {
        repo = mock(EmployeeCelebrationRepository.class);
        settings = mock(PayslipSettingsService.class);
        current = new PayslipSettingsService.Settings();
        when(settings.get()).thenAnswer(i -> current);
        when(repo.save(any(EmployeeCelebration.class))).thenAnswer(i -> { saved.add(i.getArgument(0)); return i.getArgument(0); });
        when(repo.existsByEmployeeIdAndSourceTypeAndSourceId(anyLong(), anyString(), anyLong()))
                .thenAnswer(i -> saved.stream().anyMatch(c -> c.getEmployeeId().equals(i.getArgument(0))
                        && c.getSourceType().equals(i.getArgument(1)) && c.getSourceId().equals(i.getArgument(2))));
        service = new EmployeeCelebrationService(repo, settings, mock(com.arudra.crm.repository.PayslipLineItemRepository.class));
        emp = new Employee();
        emp.setId(7L);
    }

    @Test
    void oneCardPerPaymentEvenIfGivenTwice() {
        service.give(emp, "BONUS", "BONUS", 1L, "Festival bonus", new BigDecimal("500"), "Great work");
        service.give(emp, "BONUS", "BONUS", 1L, "Festival bonus", new BigDecimal("500"), "Great work");
        assertEquals(1, saved.size());
        assertEquals("Great work", saved.get(0).getNote());
        assertFalse(saved.get(0).isOpened());
    }

    @Test
    void respectsSwitchesAndIgnoresZeroAmounts() {
        current.getCelebrations().setAllowance(false);
        service.give(emp, "ALLOWANCE", "REQUEST", 2L, "Travel allowance", new BigDecimal("300"), null);
        service.give(emp, "BONUS", "BONUS", 3L, "Bonus", BigDecimal.ZERO, null);
        assertTrue(saved.isEmpty());

        current.getCelebrations().setEnabled(false);
        service.give(emp, "BONUS", "BONUS", 4L, "Bonus", new BigDecimal("100"), null);
        assertTrue(saved.isEmpty());
    }

    @Test
    void aFailureNeverBlocksThePayment() {
        when(repo.save(any(EmployeeCelebration.class))).thenThrow(new RuntimeException("db down"));
        assertDoesNotThrow(() -> service.give(emp, "BONUS", "BONUS", 5L, "Bonus", new BigDecimal("100"), null));
    }

    @Test
    @SuppressWarnings("unchecked")
    void monthTotalCountsExtrasNotSalary() {
        EmployeeCelebration bonus = card("BONUS", "200", false);
        EmployeeCelebration salary = card("SALARY", "20000", true);
        when(repo.findByEmployeeIdAndIsDeletedFalseOrderByRewardDateDescIdDesc(7L)).thenReturn(List.of(bonus, salary));
        Map<String, Object> out = service.mine(7L);
        assertEquals(0, ((BigDecimal) out.get("monthTotal")).compareTo(new BigDecimal("200")));
        assertEquals(1, out.get("unopened"));
    }

    private EmployeeCelebration card(String kind, String amount, boolean opened) {
        EmployeeCelebration c = new EmployeeCelebration();
        c.setKind(kind);
        c.setAmount(new BigDecimal(amount));
        c.setOpened(opened);
        c.setRewardDate(LocalDate.now());
        return c;
    }
}

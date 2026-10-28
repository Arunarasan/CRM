package com.arudra.crm.service;

import com.arudra.crm.entity.PayrollRequest;
import com.arudra.crm.entity.PayslipLineItem;
import com.arudra.crm.entity.SalaryRecord;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** Allowance earnings raise pay; PAID lines only reduce the balance payable. */
class AlreadyPaidAllowanceTest {

    private static PayslipLineItem item(String category, String amount) {
        PayslipLineItem i = new PayslipLineItem();
        i.setCategory(category);
        i.setLabel(category);
        i.setAmount(new BigDecimal(amount));
        return i;
    }

    @Test
    void paidLinesDoNotChangeGrossOrNet() {
        SalaryRecord r = new SalaryRecord();
        r.setRegularEarnings(new BigDecimal("10000"));
        PayslipEditService.applyTotals(r, List.of(item("EARNING", "500"), item("PAID", "500"), item("DEDUCTION", "200")));
        assertEquals(0, r.getGrossEarnings().compareTo(new BigDecimal("10500")));
        assertEquals(0, r.getNetSalary().compareTo(new BigDecimal("10300")));
        assertEquals(0, r.getAlreadyPaid().compareTo(new BigDecimal("500")));
    }

    @Test
    void alreadyPaidIsRecomputedWhenPaidLinesAreRemoved() {
        SalaryRecord r = new SalaryRecord();
        r.setAlreadyPaid(new BigDecimal("500"));
        PayslipEditService.applyTotals(r, List.of(item("EARNING", "500")));
        assertEquals(0, r.getAlreadyPaid().signum());
    }

    @Test
    void approvalDefaultsToAlreadyPaidTodayInCash() {
        PayrollService service = new PayrollService();
        PayrollRequest req = new PayrollRequest();
        req.setRequestType("ALLOWANCE");
        req.setAmount(new BigDecimal("300"));
        ReflectionTestUtils.invokeMethod(service, "applyAllowanceApproval", req, (Map<String, Object>) null);
        assertTrue(req.isAlreadyPaid());
        assertEquals(LocalDate.now(), req.getPaidOn());
        assertEquals("CASH", req.getPaidMode());
        assertNotNull(req.getTargetMonth());
    }

    @Test
    void hrCanChangeAmountAndMarkItNotPaid() {
        PayrollService service = new PayrollService();
        PayrollRequest req = new PayrollRequest();
        req.setAmount(new BigDecimal("300"));
        ReflectionTestUtils.invokeMethod(service, "applyAllowanceApproval", req,
                Map.<String, Object>of("amount", "250", "alreadyPaid", false));
        assertEquals(0, req.getAmount().compareTo(new BigDecimal("250")));
        assertFalse(req.isAlreadyPaid());
        assertNull(req.getPaidOn());
    }

    @Test
    void rejectsZeroAmountOnApproval() {
        PayrollService service = new PayrollService();
        PayrollRequest req = new PayrollRequest();
        assertThrows(IllegalArgumentException.class, () -> ReflectionTestUtils.invokeMethod(service, "applyAllowanceApproval", req,
                Map.<String, Object>of("amount", "0")));
    }
}

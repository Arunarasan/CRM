package com.arudra.crm.service;

import com.arudra.crm.entity.PayslipLineItem;
import com.arudra.crm.entity.SalaryRecord;
import com.arudra.crm.repository.PayslipLineItemRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Several allowance requests in a month land on ONE earning line and ONE paid line per kind. */
class AllowanceLineMergeTest {

    @Test
    void threeRequestsOfThreeHundredBecomeOneNineHundredLine() {
        List<PayslipLineItem> saved = new ArrayList<>();
        PayslipLineItemRepository repo = mock(PayslipLineItemRepository.class);
        when(repo.findBySalaryRecordIdAndIsDeletedFalseOrderByIdAsc(any())).thenAnswer(i -> List.copyOf(saved));
        when(repo.save(any(PayslipLineItem.class))).thenAnswer(i -> {
            PayslipLineItem it = i.getArgument(0);
            if (!saved.contains(it)) saved.add(it);
            return it;
        });
        PayrollService service = new PayrollService();
        ReflectionTestUtils.setField(service, "lineItemRepository", repo);

        SalaryRecord rec = new SalaryRecord();
        rec.setId(1L);
        for (int i = 0; i < 3; i++) {
            ReflectionTestUtils.invokeMethod(service, "addAllowanceLine", rec, "EARNING", "Travel allowance", new BigDecimal("300"));
            ReflectionTestUtils.invokeMethod(service, "addAllowanceLine", rec, "PAID", "Travel allowance paid", new BigDecimal("300"));
        }
        ReflectionTestUtils.invokeMethod(service, "addAllowanceLine", rec, "EARNING", "Food allowance", new BigDecimal("80"));

        assertEquals(3, saved.size());
        assertEquals(0, saved.get(0).getAmount().compareTo(new BigDecimal("900")));
        assertEquals("Travel allowance", saved.get(0).getLabel());
        assertEquals(0, saved.get(1).getAmount().compareTo(new BigDecimal("900")));
        assertEquals("PAID", saved.get(1).getCategory());
        assertEquals("Food allowance", saved.get(2).getLabel());
    }
}

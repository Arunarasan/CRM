package com.arudra.crm.service;

import com.arudra.crm.entity.SiteSetting;
import com.arudra.crm.repository.SiteSettingRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PayslipSettingsServiceTest {

    private SiteSettingRepository repo;
    private PayslipSettingsService service;
    private SiteSetting stored;

    @BeforeEach
    void setUp() {
        repo = mock(SiteSettingRepository.class);
        stored = null;
        when(repo.findBySettingKeyAndIsDeletedFalse(PayslipSettingsService.KEY))
                .thenAnswer(i -> Optional.ofNullable(stored));
        when(repo.save(any(SiteSetting.class))).thenAnswer(i -> { stored = i.getArgument(0); return stored; });
        service = new PayslipSettingsService(repo, new ObjectMapper());
    }

    @Test
    void defaultsWhenNothingSaved() {
        PayslipSettingsService.Settings s = service.get();
        assertFalse(s.getAuto().isEnabled());
        assertEquals("GENERATED", s.getVisibility().getReleaseOn());
        assertTrue(s.getLines().isEmpty());
    }

    @Test
    void savesAndReadsBackWithIdsAssigned() {
        PayslipSettingsService.Settings in = new PayslipSettingsService.Settings();
        PayslipSettingsService.DefaultLine l = new PayslipSettingsService.DefaultLine();
        l.setLabel("  Travel  ");
        l.setValue(new BigDecimal("1500"));
        in.getLines().add(l);
        service.save(in);

        PayslipSettingsService.Settings out = service.get();
        assertEquals(1, out.getLines().size());
        assertEquals("Travel", out.getLines().get(0).getLabel());
        assertNotNull(out.getLines().get(0).getId());
    }

    @Test
    void builtinsAndOptionsDefaultThenCanBeRenamedSwitchedOffAndReset() {
        PayslipSettingsService.Settings d = service.get();
        assertEquals(5, d.getBuiltins().size());
        assertEquals("Leads collected", d.getBuiltins().get(PayslipSettingsService.LEAD_REWARD).getLabel());
        assertTrue(d.getOptions().stream().anyMatch(o -> o.getLabel().equals("Penalty") && o.getCategory().equals("DEDUCTION")));

        PayslipSettingsService.Settings edit = service.get();
        edit.getBuiltins().get(PayslipSettingsService.LEAD_REWARD).setLabel("Lead bonus");
        edit.getBuiltins().get(PayslipSettingsService.REVIEW_REWARD).setEnabled(false);
        edit.getOptions().removeIf(o -> o.getLabel().equals("Bonus"));
        service.save(edit);

        PayslipSettingsService.Settings back = service.get();
        assertEquals("Lead bonus", service.builtin(PayslipSettingsService.LEAD_REWARD).getLabel());
        assertFalse(service.builtin(PayslipSettingsService.REVIEW_REWARD).isEnabled());
        assertFalse(service.optionLabels("EARNING").contains("Bonus"));

        // "Reset" = the factory defaults, which a Save puts back.
        service.save(service.defaults());
        assertEquals("Leads collected", service.builtin(PayslipSettingsService.LEAD_REWARD).getLabel());
        assertTrue(service.builtin(PayslipSettingsService.REVIEW_REWARD).isEnabled());
        assertTrue(service.optionLabels("EARNING").contains("Bonus"));
        assertNotNull(back);
    }

    @Test
    void rejectsDuplicateOrBlankQuickPicks() {
        PayslipSettingsService.Settings dup = service.get();
        dup.getOptions().add(new PayslipSettingsService.Option(null, "penalty", "DEDUCTION"));
        assertThrows(IllegalArgumentException.class, () -> service.save(dup));

        PayslipSettingsService.Settings blank = service.get();
        blank.getOptions().add(new PayslipSettingsService.Option(null, "  ", "EARNING"));
        assertThrows(IllegalArgumentException.class, () -> service.save(blank));
    }

    @Test
    void rejectsBadInput() {
        PayslipSettingsService.Settings s = new PayslipSettingsService.Settings();
        s.getAuto().setDayOfMonth(31);
        assertThrows(IllegalArgumentException.class, () -> service.save(s));

        PayslipSettingsService.Settings p = new PayslipSettingsService.Settings();
        PayslipSettingsService.DefaultLine l = new PayslipSettingsService.DefaultLine();
        l.setLabel("PF"); l.setType("PERCENT"); l.setValue(new BigDecimal("120"));
        p.getLines().add(l);
        assertThrows(IllegalArgumentException.class, () -> service.save(p));

        PayslipSettingsService.Settings c = new PayslipSettingsService.Settings();
        c.getTemplate().setAccentColor("green");
        assertThrows(IllegalArgumentException.class, () -> service.save(c));
    }

    @Test
    void saveDoesNotRewindSchedulerBookkeeping() {
        service.save(new PayslipSettingsService.Settings());
        service.recordRun("2026-09", "3 generated");
        PayslipSettingsService.Settings edit = new PayslipSettingsService.Settings();
        edit.getAuto().setLastRunPeriod("1999-01");
        service.save(edit);
        assertEquals("2026-09", service.get().getAuto().getLastRunPeriod());
    }

    @Test
    void schedulerRunsOncePerPeriodOnOrAfterTheChosenDay() {
        PayrollService payroll = mock(PayrollService.class);
        when(payroll.generatePayslips(anyInt(), anyInt(), any()))
                .thenReturn(java.util.Map.of("generated", 2, "skipped", 1, "errors", java.util.List.of()));
        PayslipAutoGenerateScheduler sched = new PayslipAutoGenerateScheduler();
        org.springframework.test.util.ReflectionTestUtils.setField(sched, "settingsService", service);
        org.springframework.test.util.ReflectionTestUtils.setField(sched, "payrollService", payroll);
        org.springframework.test.util.ReflectionTestUtils.setField(sched, "notificationService", mock(NotificationService.class));

        PayslipSettingsService.Settings s = new PayslipSettingsService.Settings();
        s.getAuto().setEnabled(true);
        s.getAuto().setDayOfMonth(5);
        service.save(s);

        assertNull(sched.runIfDue(LocalDate.of(2026, 10, 4)), "before the chosen day");
        assertNotNull(sched.runIfDue(LocalDate.of(2026, 10, 7)), "catches up after the day");
        assertNull(sched.runIfDue(LocalDate.of(2026, 10, 8)), "already done this period");

        ArgumentCaptor<Integer> month = ArgumentCaptor.forClass(Integer.class);
        verify(payroll, times(1)).generatePayslips(month.capture(), eq(2026), any());
        assertEquals(9, month.getValue(), "PREVIOUS period = September");
    }
}

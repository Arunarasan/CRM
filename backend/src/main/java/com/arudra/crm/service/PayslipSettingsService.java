package com.arudra.crm.service;

import com.arudra.crm.entity.SiteSetting;
import com.arudra.crm.repository.SiteSettingRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.Setter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * HR's payslip presets, kept as one JSON document in {@code site_settings} (key {@code payroll.payslip_settings},
 * hidden from the public site by the {@code payroll.} prefix): the monthly auto-generate schedule, default
 * allowance/deduction lines added to every generated payslip, the printed template and when employees see it.
 */
@Service
public class PayslipSettingsService {

    private static final Logger log = LoggerFactory.getLogger(PayslipSettingsService.class);
    static final String KEY = "payroll.payslip_settings";

    private final SiteSettingRepository settingRepo;
    private final ObjectMapper mapper;

    public PayslipSettingsService(SiteSettingRepository settingRepo, ObjectMapper mapper) {
        this.settingRepo = settingRepo;
        this.mapper = mapper;
    }

    @Getter @Setter @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Auto {
        private boolean enabled = false;
        /** Day of the month (1–28) the run happens on. */
        private int dayOfMonth = 1;
        /** PREVIOUS = the month that just ended; CURRENT = the month in progress. */
        private String period = "PREVIOUS";
        /** AUTO = each employee's usual basis, or force HOURLY / MONTHLY. */
        private String basis = "AUTO";
        private boolean notifyHr = true;
        /** yyyy-MM of the last period the scheduler generated, so a period runs once. Server-managed. */
        private String lastRunPeriod;
        private String lastRunSummary;
    }

    @Getter @Setter @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DefaultLine {
        private String id;
        private String label = "";
        /** EARNING | DEDUCTION */
        private String category = "EARNING";
        /** FIXED (₹) | PERCENT (% of regular + overtime pay) */
        private String type = "FIXED";
        private BigDecimal value = BigDecimal.ZERO;
        private boolean enabled = true;
        /** Empty = every employee. */
        private List<Long> employeeIds = new ArrayList<>();
        /** Empty = every pay basis; otherwise HOURLY or MONTHLY. */
        private String basis = "";
    }

    @Getter @Setter @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Template {
        private String title = "Payslip";
        private String accentColor = "#0f5132";
        private String registrationNo = "";
        private String footerNote = "This is a computer-generated payslip.";
        private boolean showEmployeeDetails = true;
        private boolean showBankAccount = true;
        private boolean showAttendance = true;
        private boolean showAmountInWords = true;
        private boolean showStatusLine = true;
        private boolean showSignatures = true;
        private String employeeSignLabel = "Employee signature";
        private String companySignLabel = "Authorised signatory";
    }

    @Getter @Setter @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Visibility {
        /** GENERATED | APPROVED | PAID — the stage at which the employee can see the payslip. */
        private String releaseOn = "GENERATED";
        private boolean notifyEmployee = true;
    }

    @Getter @Setter @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Settings {
        private Auto auto = new Auto();
        private List<DefaultLine> lines = new ArrayList<>();
        private Template template = new Template();
        private Visibility visibility = new Visibility();
    }

    @Transactional(readOnly = true)
    public Settings get() {
        return settingRepo.findBySettingKeyAndIsDeletedFalse(KEY)
                .map(SiteSetting::getSettingValue)
                .filter(v -> v != null && !v.isBlank())
                .map(v -> {
                    try { return mapper.readValue(v, Settings.class); }
                    catch (Exception e) { log.warn("Unreadable payslip settings, using defaults: {}", e.getMessage()); return new Settings(); }
                })
                .orElseGet(Settings::new);
    }

    /** The printable bits only — safe to hand to any signed-in user (employees print their own payslip). */
    @Transactional(readOnly = true)
    public Template template() {
        return get().getTemplate();
    }

    @Transactional
    public Settings save(Settings in) {
        Settings cur = get();
        validate(in);
        // lastRun* is owned by the scheduler — an edit from the screen must not rewind it.
        in.getAuto().setLastRunPeriod(cur.getAuto().getLastRunPeriod());
        in.getAuto().setLastRunSummary(cur.getAuto().getLastRunSummary());
        write(in);
        return in;
    }

    /** Scheduler bookkeeping: remember that {@code period} was generated. */
    @Transactional
    public void recordRun(String period, String summary) {
        Settings s = get();
        s.getAuto().setLastRunPeriod(period);
        s.getAuto().setLastRunSummary(summary);
        write(s);
    }

    private void write(Settings s) {
        String json;
        try { json = mapper.writeValueAsString(s); }
        catch (Exception e) { throw new IllegalStateException("Could not save payslip settings.", e); }
        SiteSetting row = settingRepo.findBySettingKeyAndIsDeletedFalse(KEY).orElseGet(() -> {
            SiteSetting n = new SiteSetting();
            n.setSettingKey(KEY);
            n.setGroupName("Payroll");
            n.setLabel("Payslip settings");
            return n;
        });
        row.setSettingValue(json);
        settingRepo.save(row);
    }

    private static final Set<String> BASES = Set.of("AUTO", "HOURLY", "MONTHLY");

    private void validate(Settings s) {
        if (s.getAuto() == null) s.setAuto(new Auto());
        if (s.getTemplate() == null) s.setTemplate(new Template());
        if (s.getVisibility() == null) s.setVisibility(new Visibility());
        if (s.getLines() == null) s.setLines(new ArrayList<>());

        Auto a = s.getAuto();
        if (a.getDayOfMonth() < 1 || a.getDayOfMonth() > 28)
            throw new IllegalArgumentException("Run day must be between 1 and 28.");
        if (!List.of("PREVIOUS", "CURRENT").contains(a.getPeriod()))
            throw new IllegalArgumentException("Period must be PREVIOUS or CURRENT.");
        if (a.getBasis() == null || !BASES.contains(a.getBasis()))
            throw new IllegalArgumentException("Basis must be AUTO, HOURLY or MONTHLY.");

        for (DefaultLine l : s.getLines()) {
            if (l.getLabel() == null || l.getLabel().isBlank())
                throw new IllegalArgumentException("Every default line needs a name.");
            l.setLabel(l.getLabel().trim());
            if (l.getLabel().length() > 100)
                throw new IllegalArgumentException("'" + l.getLabel() + "' is too long (max 100 characters).");
            if (!List.of("EARNING", "DEDUCTION").contains(l.getCategory()))
                throw new IllegalArgumentException("'" + l.getLabel() + "': category must be EARNING or DEDUCTION.");
            if (!List.of("FIXED", "PERCENT").contains(l.getType()))
                throw new IllegalArgumentException("'" + l.getLabel() + "': type must be FIXED or PERCENT.");
            if (l.getValue() == null || l.getValue().signum() < 0)
                throw new IllegalArgumentException("'" + l.getLabel() + "': amount can't be negative.");
            if ("PERCENT".equals(l.getType()) && l.getValue().compareTo(BigDecimal.valueOf(100)) > 0)
                throw new IllegalArgumentException("'" + l.getLabel() + "': percent can't be above 100.");
            if (l.getBasis() == null) l.setBasis("");
            if (!l.getBasis().isEmpty() && !List.of("HOURLY", "MONTHLY").contains(l.getBasis()))
                throw new IllegalArgumentException("'" + l.getLabel() + "': basis must be blank, HOURLY or MONTHLY.");
            if (l.getEmployeeIds() == null) l.setEmployeeIds(new ArrayList<>());
            if (l.getId() == null || l.getId().isBlank()) l.setId(UUID.randomUUID().toString());
        }

        if (!List.of("GENERATED", "APPROVED", "PAID").contains(s.getVisibility().getReleaseOn()))
            throw new IllegalArgumentException("Release stage must be GENERATED, APPROVED or PAID.");

        Template t = s.getTemplate();
        if (t.getAccentColor() == null || !t.getAccentColor().matches("^#[0-9a-fA-F]{6}$"))
            throw new IllegalArgumentException("Accent colour must look like #0f5132.");
        if (t.getTitle() == null || t.getTitle().isBlank()) t.setTitle("Payslip");
        if (t.getTitle().length() > 60) throw new IllegalArgumentException("Payslip title is too long (max 60).");
        if (t.getFooterNote() != null && t.getFooterNote().length() > 300)
            throw new IllegalArgumentException("Footer note is too long (max 300).");
    }
}

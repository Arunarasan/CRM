package com.arudra.crm.service;

import com.arudra.crm.entity.Contractor;
import com.arudra.crm.entity.ContractorBill;
import com.arudra.crm.entity.ContractorPayment;
import com.arudra.crm.entity.User;
import com.arudra.crm.repository.ContractorBillRepository;
import com.arudra.crm.repository.ContractorPaymentRepository;
import com.arudra.crm.repository.ContractorRepository;
import com.arudra.crm.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Scan-based workforce/contractor payment alerts, dispatched through the existing
 * {@link NotificationService}. Invoked on demand (HR endpoint) or by a scheduler. Agreement-expiry is
 * already covered by {@code /api/contractors/compliance-alerts}; event alerts (submitted/approved) are
 * raised inline by {@link ContractorBillingService}. This fills the remaining money-timing alerts.
 */
@Service
public class WorkforceAlertService {

    private static final List<String> FINANCE_ROLES =
            List.of("ROLE_ADMIN", "ROLE_FINANCE_MANAGER", "ROLE_ACCOUNTS", "ROLE_MANAGER");

    @Autowired private ContractorRepository contractorRepository;
    @Autowired private ContractorBillRepository billRepository;
    @Autowired private ContractorPaymentRepository paymentRepository;
    @Autowired private ContractorBillingService billingService;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationService notificationService;

    public Map<String, Object> runAlerts() {
        int overdue = 0, finalPending = 0, contractClosedWithBalance = 0;

        // Overdue payments.
        for (ContractorPayment p : paymentRepository.findByStatusOrderByIdDesc("OVERDUE")) {
            String name = p.getContractor() != null ? p.getContractor().getName() : "Contractor";
            notify("Contractor payment overdue",
                    "Payment of ₹" + p.getAmount() + " to " + name + " is overdue.",
                    "/contractors/directory/" + (p.getContractor() != null ? p.getContractor().getId() : ""));
            overdue++;
        }

        // Final bill approved but not fully paid.
        for (ContractorBill b : billRepository.findPayable()) {
            if ("FINAL".equalsIgnoreCase(b.getBillType()) && nz(b.getBalanceAmount()).signum() > 0) {
                notify("Final payment pending",
                        "Final bill " + b.getBillNumber() + " has a pending balance of ₹" + b.getBalanceAmount() + ".",
                        "/contractors/bills/" + b.getId());
                finalPending++;
            }
        }

        // Contract ended (agreement date passed) but ledger/bills still carry a balance.
        LocalDate today = LocalDate.now();
        for (Contractor c : contractorRepository.findAll()) {
            if (c.getAgreementEndDate() != null && c.getAgreementEndDate().isBefore(today)) {
                BigDecimal outstanding = nz((BigDecimal) billingService.getOutstanding(c.getId()).get("billedOutstanding"));
                if (outstanding.signum() > 0) {
                    notify("Contract completed with pending balance",
                            c.getName() + "'s contract ended on " + c.getAgreementEndDate()
                                    + " with ₹" + outstanding + " still outstanding.",
                            "/contractors/directory/" + c.getId());
                    contractClosedWithBalance++;
                }
            }
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("overduePayments", overdue);
        summary.put("finalPaymentsPending", finalPending);
        summary.put("contractsClosedWithBalance", contractClosedWithBalance);
        return summary;
    }

    private void notify(String title, String message, String actionUrl) {
        for (User u : userRepository.findByRoleNames(FINANCE_ROLES)) {
            notificationService.dispatch(title, message, "CONTRACTOR_PAYMENT", u.getId(), actionUrl);
        }
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}

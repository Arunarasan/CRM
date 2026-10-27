package com.arudra.crm.service;

import com.arudra.crm.entity.Contractor;
import com.arudra.crm.entity.ContractorOrder;
import com.arudra.crm.entity.Project;
import com.arudra.crm.repository.ContractorOrderRepository;
import com.arudra.crm.repository.ContractorPaymentRepository;
import com.arudra.crm.repository.ContractorRepository;
import com.arudra.crm.repository.ProjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Simple "orders given to a contractor": a job on a project with an agreed amount.
 * Paid / received / balance / status are always calculated from linked payments. Creating an order
 * credits the contractor ledger (we now owe the agreed amount); every payment then debits it, so the
 * ledger balance stays the single source for "who owes whom".
 */
@Service
public class ContractorOrderService {

    @Autowired private ContractorOrderRepository orderRepository;
    @Autowired private ContractorPaymentRepository paymentRepository;
    @Autowired private ContractorRepository contractorRepository;
    @Autowired private ProjectRepository projectRepository;
    @Autowired private ContractorLedgerService ledgerService;
    @Autowired private ProjectFinanceService projectFinanceService;

    // =====================================================================
    // Reads
    // =====================================================================

    @Transactional(readOnly = true)
    public Map<String, Object> getOrders(Long contractorId) {
        List<Map<String, Object>> rows = new ArrayList<>();
        BigDecimal ordered = BigDecimal.ZERO, paid = BigDecimal.ZERO, received = BigDecimal.ZERO;
        for (ContractorOrder o : orderRepository.findByContractorIdAndIsDeletedFalseOrderByOrderDateDescIdDesc(contractorId)) {
            Map<String, Object> row = toRow(o);
            rows.add(row);
            if (!"CANCELLED".equals(o.getStatus())) {
                ordered = ordered.add(nz(o.getAmount()));
                paid = paid.add((BigDecimal) row.get("paid"));
                received = received.add((BigDecimal) row.get("received"));
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("orders", rows);
        out.put("totalOrdered", ordered);
        out.put("totalPaid", paid);
        out.put("totalReceived", received);
        out.put("totalBalance", ordered.subtract(paid).add(received));
        out.putAll(settlement(contractorId));
        return out;
    }

    /**
     * Final position: positive balance = we need to pay him, negative = he needs to pay us.
     * Taken straight from the ledger so bills, orders, advances and receipts all count once.
     */
    public Map<String, Object> settlement(Long contractorId) {
        BigDecimal balance = ledgerService.getBalance(contractorId);
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("finalBalance", balance);
        s.put("finalDirection", balance.signum() > 0 ? "WE_PAY" : balance.signum() < 0 ? "HE_PAYS" : "SETTLED");
        s.put("finalAmount", balance.abs());
        return s;
    }

    // =====================================================================
    // Writes
    // =====================================================================

    @Transactional
    public ContractorOrder create(Long contractorId, Long projectId, String title, BigDecimal amount,
                                  LocalDate orderDate, String notes) {
        Contractor contractor = contractorRepository.findById(contractorId)
                .orElseThrow(() -> new IllegalArgumentException("Contractor not found: " + contractorId));
        Project project = requireProject(projectId);
        validate(title, amount);

        ContractorOrder o = new ContractorOrder();
        o.setContractor(contractor);
        o.setProject(project);
        o.setTitle(title.trim());
        o.setAmount(amount);
        o.setOrderDate(orderDate != null ? orderDate : LocalDate.now());
        o.setNotes(notes);
        o = orderRepository.save(o);
        ledgerService.postOrder(o);
        syncCost(o);
        return o;
    }

    /** A job's agreed amount is project cost, so every change re-syncs the project's expenses. */
    private void syncCost(ContractorOrder o) {
        try {
            projectFinanceService.syncProjectExpenses(o.getProject().getId());
        } catch (Exception ignored) {
            // reporting convenience; never fail the order itself
        }
    }

    @Transactional
    public ContractorOrder update(Long orderId, Long projectId, String title, BigDecimal amount,
                                  LocalDate orderDate, String notes) {
        ContractorOrder o = get(orderId);
        if ("CANCELLED".equals(o.getStatus())) {
            throw new IllegalStateException("A cancelled order can't be edited.");
        }
        validate(title, amount);
        BigDecimal settled = nz(paymentRepository.sumPaidByOrder(orderId));
        if (amount.compareTo(settled) < 0) {
            throw new IllegalArgumentException("Order amount can't be lower than the " + settled
                    + " already paid against it.");
        }
        BigDecimal diff = amount.subtract(nz(o.getAmount()));
        if (projectId != null && !projectId.equals(o.getProject().getId())) {
            o.setProject(requireProject(projectId));
        }
        o.setTitle(title.trim());
        o.setAmount(amount);
        if (orderDate != null) o.setOrderDate(orderDate);
        o.setNotes(notes);
        o = orderRepository.save(o);
        if (diff.signum() != 0) {
            ledgerService.postOrderAdjustment(o, diff);
        }
        syncCost(o);
        return o;
    }

    /** Only an order with no payments can be cancelled; its ledger credit is reversed. */
    @Transactional
    public ContractorOrder cancel(Long orderId) {
        ContractorOrder o = get(orderId);
        if ("CANCELLED".equals(o.getStatus())) return o;
        if (nz(paymentRepository.sumPaidByOrder(orderId)).signum() > 0
                || nz(paymentRepository.sumReceivedByOrder(orderId)).signum() > 0) {
            throw new IllegalStateException("This order already has payments — it can't be cancelled.");
        }
        o.setStatus("CANCELLED");
        o = orderRepository.save(o);
        ledgerService.postOrderAdjustment(o, nz(o.getAmount()).negate());
        syncCost(o);
        return o;
    }

    public ContractorOrder get(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found: " + orderId));
    }

    /** Balance still to pay on one order (never negative) — used to stop over-payment. */
    public BigDecimal remainingToPay(ContractorOrder o) {
        return nz(o.getAmount()).subtract(nz(paymentRepository.sumPaidByOrder(o.getId())))
                .add(nz(paymentRepository.sumReceivedByOrder(o.getId()))).max(BigDecimal.ZERO);
    }

    // =====================================================================

    private Map<String, Object> toRow(ContractorOrder o) {
        BigDecimal paid = nz(paymentRepository.sumPaidByOrder(o.getId()));
        BigDecimal received = nz(paymentRepository.sumReceivedByOrder(o.getId()));
        BigDecimal balance = nz(o.getAmount()).subtract(paid).add(received);
        String status;
        if ("CANCELLED".equals(o.getStatus())) status = "CANCELLED";
        else if (balance.signum() < 0) status = "OVERPAID";
        else if (balance.signum() == 0 && nz(o.getAmount()).signum() > 0) status = "PAID";
        else if (paid.signum() > 0) status = "PARTLY_PAID";
        else status = "UNPAID";

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", o.getId());
        row.put("title", o.getTitle());
        row.put("orderDate", o.getOrderDate());
        row.put("notes", o.getNotes());
        row.put("projectId", o.getProject().getId());
        row.put("projectName", o.getProject().getProjectName());
        row.put("amount", o.getAmount());
        row.put("paid", paid);
        row.put("received", received);
        row.put("balance", balance);
        row.put("status", status);
        return row;
    }

    private Project requireProject(Long projectId) {
        if (projectId == null) throw new IllegalArgumentException("Choose the project this order is for.");
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new IllegalArgumentException("Project not found: " + projectId));
    }

    private static void validate(String title, BigDecimal amount) {
        if (title == null || title.isBlank()) throw new IllegalArgumentException("Describe the job.");
        if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("Order amount must be greater than zero.");
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}

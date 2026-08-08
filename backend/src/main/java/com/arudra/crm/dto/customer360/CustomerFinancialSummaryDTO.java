package com.arudra.crm.dto.customer360;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Gated behind CUSTOMER_FINANCIAL_READ — backs Tab 10 (Payments) and the financial sidebar figures. */
@Data
public class CustomerFinancialSummaryDTO {
    private BigDecimal totalInvoiced;
    private BigDecimal totalPaid;
    private BigDecimal advancePaid;
    private BigDecimal outstandingBalance;
    private BigDecimal creditLimit;
    private String paymentTerms;
    private LocalDate lastPaymentDate;
    private long invoiceCount;
    private long paymentCount;
}

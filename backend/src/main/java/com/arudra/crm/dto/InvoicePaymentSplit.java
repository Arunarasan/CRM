package com.arudra.crm.dto;

import java.math.BigDecimal;

/**
 * One tender line when marking an invoice paid — lets a single settlement be split/combined
 * across methods (e.g. part CASH, part UPI). An empty split list means "pay the full balance
 * in one CASH payment".
 */
public record InvoicePaymentSplit(String method, BigDecimal amount, String referenceNumber) {
}

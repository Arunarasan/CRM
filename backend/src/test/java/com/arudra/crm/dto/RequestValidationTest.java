package com.arudra.crm.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** AUD-002: money and auth request DTOs reject nonsense before it reaches a service. */
class RequestValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void counterSaleRejectsNegativeQuantityPriceAndDiscount() {
        CounterSaleRequest.Item item = new CounterSaleRequest.Item();
        item.quantity = -2;
        item.unitPrice = new BigDecimal("-10");
        item.gstRate = new BigDecimal("250");
        CounterSaleRequest req = new CounterSaleRequest();
        req.items = List.of(item);
        req.discountValue = new BigDecimal("-1");
        req.paidAmount = new BigDecimal("-5");
        assertEquals(5, validator.validate(req).size());
    }

    @Test
    void counterSaleAcceptsSensibleValues() {
        CounterSaleRequest.Item item = new CounterSaleRequest.Item();
        item.quantity = 3;
        item.unitPrice = new BigDecimal("499.50");
        item.gstRate = new BigDecimal("18");
        CounterSaleRequest req = new CounterSaleRequest();
        req.items = List.of(item);
        assertTrue(validator.validate(req).isEmpty());
    }

    @Test
    void salesReturnNeedsInvoiceAndPositiveQuantity() {
        SalesReturnRequest.Line line = new SalesReturnRequest.Line();
        line.quantity = 0;
        SalesReturnRequest req = new SalesReturnRequest();
        req.items = List.of(line);
        assertEquals(2, validator.validate(req).size());
    }

    @Test
    void passwordResetRejectsBlankFields() {
        assertEquals(3, validator.validate(new PasswordResetRequest()).size());
    }

    @Test
    void forgotPasswordRejectsBlankEmail() {
        assertEquals(1, validator.validate(new ForgotPasswordRequest()).size());
    }
}

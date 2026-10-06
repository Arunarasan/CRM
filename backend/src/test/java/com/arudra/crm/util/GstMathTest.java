package com.arudra.crm.util;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GstMathTest {

    private static BigDecimal bd(String v) { return new BigDecimal(v); }

    @Test
    void worksGstOutOfAnInclusiveAmount() {
        assertEquals(bd("1000.00"), GstMath.exclusiveOf(bd("1180"), bd("18"), 2));
        assertEquals(bd("180.00"), GstMath.gstWithin(bd("1180"), bd("18")));
        // A price that doesn't divide evenly still splits to the paisa and adds back up.
        BigDecimal ex = GstMath.exclusiveOf(bd("999"), bd("18"), 2);
        assertEquals(bd("846.61"), ex);
        assertEquals(bd("999.00"), ex.add(GstMath.gstWithin(bd("999"), bd("18"))));
    }

    @Test
    void zeroRateLeavesTheAmountAlone() {
        assertEquals(bd("500.00"), GstMath.exclusiveOf(bd("500"), BigDecimal.ZERO, 2));
        assertEquals(bd("0.00"), GstMath.gstWithin(bd("500"), BigDecimal.ZERO));
        assertEquals(bd("500.00"), GstMath.exclusiveOf(bd("500"), null, 2));
    }

    @Test
    void addsGstOnAnExclusiveAmount() {
        assertEquals(bd("90.00"), GstMath.gstOn(bd("500"), bd("18")));
    }
}

package com.arudra.crm.util;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * GST helpers shared by every document with a "Prices include GST" toggle. With GST-inclusive prices the
 * tax is worked out of the amount instead of added on top: before-GST = amount ÷ (1 + rate/100).
 */
public final class GstMath {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private GstMath() {}

    /** The before-GST part of an amount that already includes {@code ratePercent}% GST. */
    public static BigDecimal exclusiveOf(BigDecimal inclusive, BigDecimal ratePercent, int scale) {
        if (inclusive == null) return BigDecimal.ZERO.setScale(scale, RoundingMode.HALF_UP);
        BigDecimal rate = ratePercent == null ? BigDecimal.ZERO : ratePercent;
        if (rate.signum() <= 0) return inclusive.setScale(scale, RoundingMode.HALF_UP);
        BigDecimal factor = BigDecimal.ONE.add(rate.divide(HUNDRED, 10, RoundingMode.HALF_UP));
        return inclusive.divide(factor, scale, RoundingMode.HALF_UP);
    }

    /** The GST contained in an amount that already includes {@code ratePercent}% GST (to the paisa). */
    public static BigDecimal gstWithin(BigDecimal inclusive, BigDecimal ratePercent) {
        if (inclusive == null) return BigDecimal.ZERO;
        return inclusive.setScale(2, RoundingMode.HALF_UP).subtract(exclusiveOf(inclusive, ratePercent, 2));
    }

    /** GST to add on top of a before-GST amount (to the paisa). */
    public static BigDecimal gstOn(BigDecimal exclusive, BigDecimal ratePercent) {
        if (exclusive == null || ratePercent == null) return BigDecimal.ZERO;
        return exclusive.multiply(ratePercent).divide(HUNDRED, 2, RoundingMode.HALF_UP);
    }
}

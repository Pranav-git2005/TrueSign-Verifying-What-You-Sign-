package com.truesign.verifier;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.BigInteger;

import static org.junit.jupiter.api.Assertions.*;

class IntentVerifierTest {

    @Test
    void convertsUsdcAmountUsingSixDecimals() {
        assertEquals(
                new BigInteger("500000000"),
                IntentVerifier.toRawAmount(new BigDecimal("500"),6)
        );
    }

    @Test
    void convertsEighteenDecimalTokenAmount() {
        assertEquals(
                new BigInteger("1250000000000000000"),
                IntentVerifier.toRawAmount(new BigDecimal("1.25"),18)
        );
    }

    @Test
    void rejectsAmountWithExcessPrecision() {
        assertThrows(
                ArithmeticException.class,
                () -> IntentVerifier.toRawAmount(new BigDecimal("1.0000001"),6)
        );
    }

    @Test
    void rejectsZeroAmount() {
        assertThrows(
                IllegalArgumentException.class,
                () -> IntentVerifier.toRawAmount(BigDecimal.ZERO,6)
        );
    }

    @Test
    void rejectsNegativeAmount() {
        assertThrows(
                IllegalArgumentException.class,
                () -> IntentVerifier.toRawAmount(new BigDecimal("-1"),6)
        );
    }

    @Test
    void rejectsInvalidDecimals() {
        assertThrows(
                IllegalArgumentException.class,
                () -> IntentVerifier.toRawAmount(BigDecimal.ONE,256)
        );
    }
}
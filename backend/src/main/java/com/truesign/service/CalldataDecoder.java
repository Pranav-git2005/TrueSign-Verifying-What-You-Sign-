
package com.truesign.service;

import org.springframework.stereotype.Service;

import java.math.BigInteger;
import java.util.Locale;

@Service
public class CalldataDecoder {

    private static final String ERC20_TRANSFER = "a9059cbb";
    private static final String ERC20_APPROVE = "095ea7b3";
    private static final String SET_APPROVAL_FOR_ALL = "a22cb465";

    public String getSelector(String calldata) {
        String data = normalize(calldata);

        if (data.length() < 8) {
            return null;
        }

        return data.substring(0, 8);
    }

    public boolean isErc20Transfer(String calldata) {
        return ERC20_TRANSFER.equals(getSelector(calldata));
    }

    public boolean isErc20Approve(String calldata) {
        return ERC20_APPROVE.equals(getSelector(calldata));
    }

    public boolean isSetApprovalForAll(String calldata) {
        return SET_APPROVAL_FOR_ALL.equals(getSelector(calldata));
    }

    public String decodeAddressArgument(String calldata, int argumentIndex) {
        String data = normalize(calldata);

        if (argumentIndex < 0 || data.length() < 8) {
            throw new IllegalArgumentException("Invalid calldata or argument index");
        }

        int start = 8 + (argumentIndex * 64);
        int end = start + 64;

        if (data.length() < end) {
            throw new IllegalArgumentException("Calldata does not contain the requested argument");
        }

        String word = data.substring(start, end);

        // ABI-encoded addresses must have 12 leading zero bytes.
        if (!word.substring(0, 24).matches("0{24}")) {
            throw new IllegalArgumentException("Invalid ABI-encoded address");
        }

        return "0x" + word.substring(24);
    }

    public BigInteger decodeUint256Argument(String calldata, int argumentIndex) {
        String data = normalize(calldata);

        if (argumentIndex < 0 || data.length() < 8) {
            throw new IllegalArgumentException("Invalid calldata or argument index");
        }

        int start = 8 + (argumentIndex * 64);
        int end = start + 64;

        if (data.length() < end) {
            throw new IllegalArgumentException("Calldata does not contain the requested argument");
        }

        return new BigInteger(data.substring(start, end), 16);
    }

    public boolean isUnlimitedApproval(String calldata) {
        if (!isErc20Approve(calldata)) {
            return false;
        }

        BigInteger amount = decodeUint256Argument(calldata, 1);

        return amount.compareTo(BigInteger.ONE.shiftLeft(128)) >= 0;
    }

    public boolean isApprovalForAllEnabled(String calldata) {
        if (!isSetApprovalForAll(calldata)) {
            return false;
        }

        BigInteger approved = decodeUint256Argument(calldata, 1);

        return BigInteger.ONE.equals(approved);
    }

    private String normalize(String calldata) {
        if (calldata == null || calldata.isBlank()) {
            return "";
        }

        String data = calldata.trim().toLowerCase(Locale.ROOT);

        if (data.startsWith("0x")) {
            data = data.substring(2);
        }

        if (!data.matches("[0-9a-f]*") || data.length() % 2 != 0) {
            throw new IllegalArgumentException("Invalid hexadecimal calldata");
        }

        return data;
    }
}

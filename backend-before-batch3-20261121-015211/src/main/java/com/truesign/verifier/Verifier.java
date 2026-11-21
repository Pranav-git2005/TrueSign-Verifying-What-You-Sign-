package com.truesign.verifier;

import com.truesign.dto.response.VerifierVerdictDto;
import com.truesign.entity.PaymentPassport;

public interface Verifier {

    String getVerifierName();

    VerifierVerdictDto verify(PaymentPassport passport);
}
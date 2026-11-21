
package com.truesign.repository;

import com.truesign.entity.PaymentPassport;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentPassportRepository
        extends JpaRepository<PaymentPassport, String> {
}

package com.truesign.repository;

import com.truesign.entity.PayeeRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PayeeRepository extends JpaRepository<PayeeRecord, String> {

    Optional<PayeeRecord> findByAccountAndPayee(String account, String payee);
}
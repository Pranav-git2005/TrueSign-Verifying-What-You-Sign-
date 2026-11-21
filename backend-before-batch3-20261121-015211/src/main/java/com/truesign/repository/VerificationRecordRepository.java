
package com.truesign.repository;

import com.truesign.entity.VerificationRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface VerificationRecordRepository
        extends JpaRepository<VerificationRecord, String> {

    List<VerificationRecord> findByPassportIdOrderByCreatedAtDesc(
            String passportId
    );
}

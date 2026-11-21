
package com.truesign.repository;

import com.truesign.entity.ProofBundle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProofBundleRepository
        extends JpaRepository<ProofBundle, String> {

    Optional<ProofBundle> findFirstByPassportIdOrderByCreatedAtDesc(
            String passportId
    );
}

package com.truesign.repository;

import com.truesign.entity.PassportSnapshot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PassportSnapshotRepository
        extends JpaRepository<PassportSnapshot, String> {

    List<PassportSnapshot> findByPassportIdOrderByCapturedAtEpochMsAsc(
            String passportId
    );
}
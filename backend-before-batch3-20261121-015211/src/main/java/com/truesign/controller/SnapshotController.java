package com.truesign.controller;

import com.truesign.dto.response.SnapshotDto;
import com.truesign.service.SnapshotService;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/passports/{passportId}/snapshots")
public class SnapshotController {

    private final SnapshotService snapshotService;

    public SnapshotController(SnapshotService snapshotService) {
        this.snapshotService = snapshotService;
    }

    @GetMapping
    public ResponseEntity<List<SnapshotDto>> getSnapshots(
            @PathVariable String passportId
    ) {
        return ResponseEntity.ok(
                snapshotService.getHistory(passportId)
        );
    }

    @PostMapping
    public ResponseEntity<SnapshotDto> captureSnapshot(
            @PathVariable String passportId,
            @RequestParam(defaultValue = "LIVE") String type
    ) throws Exception {

        return ResponseEntity.ok(
                snapshotService.capture(passportId, type)
        );
    }
}
package com.truesign.controller;

import com.truesign.blockchain.BlockchainService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/blockchain")
public class BlockchainController {
    private final BlockchainService blockchainService;
    public BlockchainController(BlockchainService blockchainService) { this.blockchainService = blockchainService; }

    @GetMapping("/status")
    public Map<String, Object> getStatus() { return blockchainService.getStatus(); }
}

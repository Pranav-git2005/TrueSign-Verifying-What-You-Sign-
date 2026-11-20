
package com.truesign.controller;

import com.truesign.blockchain.BlockchainService;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/blockchain")
public class BlockchainController {

    private final BlockchainService blockchainService;

    public BlockchainController(BlockchainService blockchainService) {
        this.blockchainService = blockchainService;
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() throws Exception {
        return blockchainService.getStatus();
    }
}

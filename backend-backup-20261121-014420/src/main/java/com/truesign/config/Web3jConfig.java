
package com.truesign.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

import java.time.Duration;

@Configuration
public class Web3jConfig {

    @Bean(destroyMethod = "shutdown")
    public Web3j web3j(
            @Value("${truesign.blockchain.rpc-url}") String rpcUrl,
            @Value("${truesign.blockchain.connection-timeout:10000}") int timeout) {

        HttpService httpService = new HttpService(rpcUrl);

        return Web3j.build(httpService);
    }
}

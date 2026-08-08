package com.arudra.crm.config;

import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.concurrent.ConcurrentMapCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Simple in-memory cache for Customer 360 aggregate reads (overview, dashboard stats,
 * financial summary). No external cache store exists in this project yet, so a
 * ConcurrentMapCacheManager is used rather than introducing Redis for a single feature.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager("customer360");
    }
}

package com.arudra.crm.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Lightweight Health Check Controller for Render / Uptime monitors.
 * Available without authentication at /api/health and /health.
 */
@RestController
public class HealthController {

    @Value("${server.port:10000}")
    private String serverPort;

    @Value("${spring.application.name:arudra-crm}")
    private String appName;

    @Value("${spring.profiles.active:default}")
    private String activeProfile;

    @GetMapping(value = {"/health", "/api/health"})
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("service", appName);
        health.put("profile", activeProfile);
        health.put("port", serverPort);
        health.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(health);
    }
}

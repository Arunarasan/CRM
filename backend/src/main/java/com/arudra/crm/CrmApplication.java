package com.arudra.crm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
@EnableScheduling
public class CrmApplication implements ApplicationListener<WebServerInitializedEvent> {

    private static final Logger log = LoggerFactory.getLogger(CrmApplication.class);

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(CrmApplication.class, args);
    }

    /**
     * Automatically loads .env from current directory or parent directory into System properties
     * so that Spring properties are populated during local development without external dependencies.
     */
    private static void loadDotenv() {
        Path[] possiblePaths = new Path[]{
                Paths.get(".env"),
                Paths.get("backend/.env"),
                Paths.get("../backend/.env"),
                Paths.get("../.env")
        };

        for (Path path : possiblePaths) {
            if (Files.exists(path) && Files.isRegularFile(path)) {
                try (var lines = Files.lines(path)) {
                    lines.map(String::trim)
                            .filter(line -> !line.isEmpty() && !line.startsWith("#") && line.contains("="))
                            .forEach(line -> {
                                int idx = line.indexOf('=');
                                String key = line.substring(0, idx).trim();
                                String value = line.substring(idx + 1).trim();
                                // Strip wrapping quotes if any
                                if ((value.startsWith("\"") && value.endsWith("\"")) ||
                                        (value.startsWith("'") && value.endsWith("'"))) {
                                    value = value.substring(1, value.length() - 1);
                                }
                                if (System.getProperty(key) == null && System.getenv(key) == null) {
                                    System.setProperty(key, value);
                                }
                            });
                    log.info("Loaded environment properties from: {}", path.toAbsolutePath());
                    break;
                } catch (Exception e) {
                    log.warn("Failed to load .env from: {}", path, e);
                }
            }
        }
    }

    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        int port = event.getWebServer().getPort();
        log.info("====================================================================");
        log.info("  Arudra CRM Backend started successfully!");
        log.info("  Server listening on: 0.0.0.0:{}", port);
        log.info("  Health endpoint:      http://0.0.0.0:{}/api/health", port);
        log.info("  Actuator health:     http://0.0.0.0:{}/actuator/health", port);
        log.info("====================================================================");
    }
}

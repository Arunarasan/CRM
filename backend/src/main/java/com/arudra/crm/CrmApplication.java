package com.arudra.crm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class CrmApplication implements ApplicationListener<WebServerInitializedEvent> {

    private static final Logger log = LoggerFactory.getLogger(CrmApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(CrmApplication.class, args);
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


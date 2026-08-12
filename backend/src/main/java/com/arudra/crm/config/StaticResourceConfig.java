package com.arudra.crm.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;

@Configuration
public class StaticResourceConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:./uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String location = "file:" + new File(uploadDir).getAbsolutePath() + File.separator;
        registry.addResourceHandler("/uploads/**").addResourceLocations(location);
    }

    /**
     * Uploaded files are already public (SecurityConfig permits /uploads/**). Allowing cross-origin
     * GET lets the frontend fetch an image back into the crop/rotate editor for re-editing — needed
     * in dev where the Vite app (5173) and the API are different origins. Production serves both from
     * one origin via nginx, so this is a no-op there.
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/uploads/**").allowedOrigins("*").allowedMethods("GET");
    }
}

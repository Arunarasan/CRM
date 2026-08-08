package com.arudra.crm;

import jakarta.persistence.Entity;
import org.hibernate.boot.Metadata;
import org.hibernate.boot.MetadataSources;
import org.hibernate.boot.registry.StandardServiceRegistry;
import org.hibernate.boot.registry.StandardServiceRegistryBuilder;
import org.hibernate.tool.schema.spi.SchemaManagementToolCoordinator;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeSet;

/**
 * Offline (no database) generator of the full MySQL DDL that Hibernate expects for the
 * current entity model. Output (target/generated-schema.sql) is the authoritative
 * "target schema" used to reconcile the Flyway migrations.
 * Run with: mvn -Dtest=SchemaGenTest test
 */
public class SchemaGenTest {

    @Test
    void generateFullSchema() throws Exception {
        File out = new File("target/generated-schema.sql");
        if (out.exists()) out.delete();

        Map<String, Object> settings = new HashMap<>();
        settings.put("hibernate.dialect", "org.hibernate.dialect.MySQLDialect");
        settings.put("hibernate.boot.allow_jdbc_metadata_access", "false");
        // Match Spring Boot 3.2 runtime naming defaults exactly.
        settings.put("hibernate.physical_naming_strategy",
                "org.hibernate.boot.model.naming.CamelCaseToUnderscoresNamingStrategy");
        settings.put("hibernate.implicit_naming_strategy",
                "org.springframework.boot.orm.jpa.hibernate.SpringImplicitNamingStrategy");
        // JPA schema-generation: script only, no database.
        settings.put("jakarta.persistence.schema-generation.scripts.action", "create");
        settings.put("jakarta.persistence.schema-generation.scripts.create-target", out.getAbsolutePath());
        settings.put("hibernate.hbm2ddl.delimiter", ";");

        StandardServiceRegistry registry = new StandardServiceRegistryBuilder()
                .applySettings(settings)
                .build();

        MetadataSources sources = new MetadataSources(registry);

        ClassPathScanningCandidateComponentProvider scanner =
                new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Entity.class));

        TreeSet<String> classNames = new TreeSet<>();
        scanner.findCandidateComponents("com.arudra.crm.entity")
                .forEach(bd -> classNames.add(bd.getBeanClassName()));
        for (String cn : classNames) {
            sources.addAnnotatedClass(Class.forName(cn));
        }
        System.out.println("SCHEMA-GEN: registered " + classNames.size() + " @Entity classes");

        Metadata metadata = sources.buildMetadata();

        SchemaManagementToolCoordinator.process(
                metadata, registry, settings, action -> { /* no delayed drop */ });

        System.out.println("SCHEMA-GEN: wrote " + out.getAbsolutePath()
                + " exists=" + out.exists() + " size=" + (out.exists() ? out.length() : 0));

        StandardServiceRegistryBuilder.destroy(registry);

        if (!out.exists() || out.length() == 0) {
            throw new IllegalStateException("Schema script was not generated");
        }
    }
}

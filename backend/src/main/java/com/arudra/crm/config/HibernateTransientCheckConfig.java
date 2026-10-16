package com.arudra.crm.config;

import com.arudra.crm.entity.BaseEntity;
import org.hibernate.Interceptor;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Keeps Hibernate's "is this entity new?" decision on the id, as it was before Hibernate 6.6.
 *
 * BaseEntity starts every row's @Version at 0, and Hibernate 6.6 reads a version equal to that
 * initial value as "never saved" — so a detached entity (a saved row reused in a later transaction,
 * or a {"customer":{"id":5}} reference deserialized from a request) failed with
 * TransientObjectException. Here an entity with an id is treated as existing; only id == null is new.
 */
@Configuration
public class HibernateTransientCheckConfig {

    @Bean
    public HibernatePropertiesCustomizer idBasedTransientCheck() {
        Interceptor interceptor = new Interceptor() {
            @Override
            public Boolean isTransient(Object entity) {
                if (entity instanceof BaseEntity base) {
                    return base.getId() == null;
                }
                return null; // other entities: Hibernate's default rules
            }
        };
        return props -> props.put("hibernate.session_factory.interceptor", interceptor);
    }
}

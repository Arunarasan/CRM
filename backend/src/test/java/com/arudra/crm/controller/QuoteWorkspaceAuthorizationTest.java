package com.arudra.crm.controller;

import com.arudra.crm.security.CurrentUserService;
import com.arudra.crm.service.ProjectQuoteChangeService;
import com.arudra.crm.service.QuoteWorkspaceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** AUD-003 regression guard: quote-workspace reads need pricing/project read authority. */
@WebMvcTest(controllers = QuoteWorkspaceController.class)
@Import(QuoteWorkspaceAuthorizationTest.MethodSecurityTestConfig.class)
class QuoteWorkspaceAuthorizationTest {

    @TestConfiguration
    @EnableMethodSecurity
    static class MethodSecurityTestConfig {
        @Bean
        SecurityFilterChain testChain(HttpSecurity http) throws Exception {
            return http.csrf(c -> c.disable())
                    .authorizeHttpRequests(a -> a.anyRequest().permitAll())
                    .build();
        }
    }

    @Autowired private MockMvc mvc;
    @MockBean private QuoteWorkspaceService service;
    @MockBean private ProjectQuoteChangeService projectChanges;
    @MockBean private CurrentUserService currentUserService;
    // Security filter beans that the web slice still wires up.
    @MockBean private com.arudra.crm.security.JwtUtil jwtUtil;
    @MockBean private com.arudra.crm.security.CustomUserDetailsService customUserDetailsService;
    @MockBean private com.arudra.crm.idempotency.IdempotencyStore idempotencyStore;

    @Test
    @WithMockUser(authorities = "ROLE_EMPLOYEE")
    void employeeCannotReadProjectQuoteStatus() throws Exception {
        mvc.perform(get("/api/quote-workspace/project/1")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "ROLE_EMPLOYEE")
    void employeeCannotReadLeadProject() throws Exception {
        mvc.perform(get("/api/quote-workspace/boq/1/lead-project")).andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(authorities = "PROJECT_READ")
    void projectReaderCanReadProjectQuoteStatus() throws Exception {
        when(projectChanges.status(anyLong())).thenReturn(Map.of("projectId", 1));
        mvc.perform(get("/api/quote-workspace/project/1")).andExpect(status().isOk());
    }

    @Test
    @WithMockUser(authorities = "BOQ_READ")
    void boqReaderCanReadLeadProject() throws Exception {
        when(projectChanges.leadProject(anyLong())).thenReturn(Map.of());
        mvc.perform(get("/api/quote-workspace/boq/1/lead-project")).andExpect(status().isOk());
    }
}

# BACKEND_STRUCTURE.md

## Overview

The backend (`backend/`) is a Java 17 / Spring Boot 3.2.5 application built with Maven, implementing a layered REST API (`controller → service → repository → entity`) over MySQL. Group/artifact: `com.arudra:crm-backend`. Entry point: `CrmApplication.java` (`@SpringBootApplication`).

## Directory layout

```
backend/
├── .env.example                  documents expected env vars (see PROJECT_ARCHITECTURE.md — not auto-loaded by Spring Boot)
├── pom.xml                       Maven build file / dependency manifest
├── target/                       build output (compiled classes, resource copies) — not source
└── src/main/
    ├── java/com/arudra/crm/
    │   ├── CrmApplication.java              Spring Boot entry point
    │   ├── annotation/
    │   │   └── LogActivity.java             custom @LogActivity annotation (module, action) for AOP logging
    │   ├── aspect/
    │   │   └── ActivityLoggerAspect.java    @Around advice on @LogActivity methods; logs actor/IP/UA/entityId asynchronously
    │   ├── config/
    │   │   ├── AuditorAwareImpl.java        Spring Data JPA AuditorAware — resolves "current user" for @CreatedBy/@LastModifiedBy
    │   │   ├── DataSeeder.java              CommandLineRunner: seeds roles, default admin, and sample data on empty DB
    │   │   ├── JpaConfig.java               @EnableJpaAuditing
    │   │   └── SecurityConfig.java          Spring Security filter chain, CORS, password encoder (see below)
    │   ├── controller/                      17 REST controllers — see API_DOCUMENTATION.md for full endpoint list
    │   ├── dto/                             ~20 DTOs + 2 mappers (CustomerMapper, TaskMapper) + ApiResponse envelope
    │   ├── entity/                          108 JPA entities — see DATABASE_SCHEMA.md
    │   ├── exception/
    │   │   ├── ApiError.java                standard error payload shape (status, error, message, path)
    │   │   ├── GlobalExceptionHandler.java  @ControllerAdvice — see "Error handling" below
    │   │   └── ResourceNotFoundException.java
    │   ├── repository/                      109 Spring Data JPA repositories (~1:1 with entities) +
    │   │                                    3 Specification classes (CustomerSpecification, LeadSpecification, SiteVisitSpecification)
    │   ├── security/
    │   │   ├── CustomUserDetailsService.java  loads User by email for Spring Security
    │   │   ├── JwtAuthenticationFilter.java   per-request Bearer token extraction/validation filter
    │   │   └── JwtUtil.java                   JWT generation/validation (HS256)
    │   └── service/                         17 service classes (business logic) — see BUSINESS_WORKFLOW.md
    └── resources/
        ├── application.yml                  base config: datasource, JWT, server.port=8080, hardcoded fallback defaults
        ├── application-dev.yml              ddl-auto=update, dev CORS origins
        └── application-prod.yml             ddl-auto=validate, prod CORS origins
```

No `backend/src/test` directory exists — `spring-boot-starter-test` and `spring-security-test` are declared in `pom.xml` but unused; there is no backend test coverage.

## Layered architecture

1. **Controller layer** (`controller/`) — 17 `@RestController` classes, one per domain area (Auth, Billing, Contractor, Customer, Dashboard, Expense, Hr, Inventory, Lead, Measurement, Notification, Project, Purchase, Quotation, Report, SiteVisit, Task). Controllers parse requests, delegate to services, and wrap results in the `ApiResponse<T>` envelope. Most carry `@CrossOrigin(origins = "*")` in addition to the global CORS bean (see SECURITY_AUDIT.md for the implications).
2. **Service layer** (`service/`) — 17 classes holding business logic: validation beyond bean validation, cross-entity orchestration (e.g. converting a Lead to a Customer, converting a Quotation to a Project), and calls into repositories. Some controllers (e.g. `ExpenseController`) bypass the service layer and call repositories directly.
3. **Repository layer** (`repository/`) — Spring Data JPA interfaces, largely one per entity, extending `JpaRepository`. Three `Specification` classes (`CustomerSpecification`, `LeadSpecification`, `SiteVisitSpecification`) implement dynamic/filterable queries for list endpoints.
4. **Entity layer** (`entity/`) — 108 JPA-annotated classes mapped to MySQL tables, most extending a shared `BaseEntity` for audit fields. See DATABASE_SCHEMA.md.
5. **DTO layer** (`dto/`) — request/response shapes decoupled from entities for some (but not all) endpoints; `CustomerMapper`/`TaskMapper` hand-convert between entity and DTO. Many endpoints bind directly to entities rather than DTOs (see API_DOCUMENTATION.md for which).

## Cross-cutting concerns

### Security filter chain (`config/SecurityConfig.java`)
- `@EnableWebSecurity` + `@EnableMethodSecurity` (method-level security annotations are enabled but not observed in use in the controllers reviewed).
- CSRF disabled; session policy `STATELESS`.
- `/api/auth/**` is `permitAll()`; every other request requires authentication (no fine-grained per-role rule at the `SecurityFilterChain` level — role/permission checks, if any, would have to happen inside individual controllers/services).
- `JwtAuthenticationFilter` is inserted before `UsernamePasswordAuthenticationFilter`.
- Unauthenticated requests to protected endpoints get a plain `401` via a custom `AuthenticationEntryPoint` (`"Unauthorized - Invalid or Expired Token"`), not routed through `GlobalExceptionHandler`.
- Passwords hashed with `BCryptPasswordEncoder`.
- A separate `corsConfigurationSource()` bean applies `allowedOrigins` (from `app.cors.allowed-origins`, default `http://localhost:5173`) globally with `allowCredentials(true)` — see SECURITY_AUDIT.md for how this interacts with per-controller `@CrossOrigin(origins="*")`.

### Error handling (`exception/GlobalExceptionHandler.java`)
`@ControllerAdvice` mapping exceptions to a consistent `ApiError { status, error, message, path }` JSON shape:
| Exception | HTTP status |
|---|---|
| `ResourceNotFoundException` | 404 |
| `MethodArgumentNotValidException` (bean validation) | 400, with field-level messages joined into one string |
| `AccessDeniedException` | 403 |
| `AuthenticationException` | 401 |
| `SQLIntegrityConstraintViolationException` | 409 (Conflict) |
| Any other `Exception` | 500, generic message only — the handler explicitly avoids exposing stack traces (`"An unexpected error occurred"`) |

### Activity logging (AOP)
`@LogActivity(module=..., action=...)` on a service/controller method triggers `ActivityLoggerAspect`'s `@Around` advice, which captures the authenticated username/role, client IP, and User-Agent from the current request, then asynchronously (`CompletableFuture.runAsync`) persists an `ActivityLog` row via `ActivityLogService`. Entity ID extraction from the method result uses reflection on a `getId()` method with a bare try/catch fallback to `0L` — this is a best-effort mechanism, not guaranteed accurate for every annotated method.

### Auditing
`JpaConfig` enables JPA auditing; `AuditorAwareImpl` supplies the "current auditor" (presumably the authenticated username) for `@CreatedBy`/`@LastModifiedBy` fields on `BaseEntity`.

### Data seeding
`DataSeeder` (a `CommandLineRunner`) runs on every application startup and, if the database is empty, seeds: 4 roles (`ROLE_ADMIN`, `ROLE_SALES`, `ROLE_PROJECT_MANAGER`, `ROLE_EMPLOYEE`), a default admin user, and sample Customer/Lead/Project/Task records. This is the only bootstrap/fixture mechanism in the project — there are no separate seed scripts.

## Configuration profiles

| File | Purpose |
|---|---|
| `application.yml` | base config: MySQL datasource (`jdbc:mysql://localhost:3306/arudra_crm?createDatabaseIfNotExist=true`), JWT secret/expiration, `server.port=8080` — contains hardcoded fallback defaults for secrets (flagged in SECURITY_AUDIT.md) |
| `application-dev.yml` | `ddl-auto: update` (Hibernate auto-migrates schema), dev-only CORS origins |
| `application-prod.yml` | `ddl-auto: validate` (schema must already match entities — fails fast instead of auto-altering) |

## Key dependencies (`pom.xml`)

spring-boot-starter-web, spring-boot-starter-data-jpa, spring-boot-starter-security, spring-boot-starter-validation, spring-boot-starter-aop, `io.jsonwebtoken` (jjwt-api/impl/jackson 0.11.5), `com.mysql:mysql-connector-j` (runtime), Lombok, spring-boot-starter-test + spring-security-test (test scope, currently unused).

## Related documents

- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — entity/table reference
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — endpoint reference
- [BUSINESS_WORKFLOW.md](BUSINESS_WORKFLOW.md) — service-layer business logic and cross-module flow
- [SECURITY_AUDIT.md](SECURITY_AUDIT.md) — security findings on the mechanisms described above

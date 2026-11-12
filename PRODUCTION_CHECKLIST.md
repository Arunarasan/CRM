# Production Checklist (status as of 2026-11-12)

- [x] Prod profile has no JWT/DB secret fallbacks (application-prod.yml)
- [x] Default admin not seeded in prod
- [x] Flyway migrations (171 files) with V1 baseline
- [x] Nightly encrypted offsite backup implemented and documented
- [x] Backend unit tests pass locally (139/139); frontend builds
- [x] Health endpoint (/health, /actuator/health)
- [ ] CI runs `mvn test` before deploy (AUD-001)
- [ ] Restore drill on an isolated DB (NOT TESTED)
- [ ] Verify HSTS / security headers / HTTPS at the proxy with curl -I (AUD-008)
- [ ] Authenticated 403 test per role across sensitive endpoints (AUD-003)
- [ ] Load test with measured results
- [ ] Dependency scan (OWASP dependency-check, npm audit)
- [ ] Confirm no sensitive files remain under public /uploads (AUD-004)
- [ ] Rollback procedure documented and rehearsed
- [ ] Monitoring/alerting on health and backup failures

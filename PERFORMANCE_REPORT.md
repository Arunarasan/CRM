# Performance Report

**No load or latency testing was executed.** No isolated stack (MySQL/Docker unavailable on this machine) was run, so there are no response-time, throughput, percentile, CPU, memory or pool numbers. None are claimed, and no concurrency capacity is claimed.

## Measured
- Frontend production build succeeds in 6.4 s.
- Largest chunks (minified / gzip): face-api 1,315 KB / 330 KB; index 804 KB / 220 KB; jspdf 400 KB / 130 KB; BarcodeScanner 480 KB / 126 KB; ProjectCommandCenter 357 KB / 80 KB.

## Recommended (NOT DONE)
1. Stand up staging with anonymised data; run k6/JMeter at 1/10/25/50/100 users on login, lead list, project page, invoice create, payroll run.
2. Enable Hibernate statistics / slow query log to find N+1 on project, lead and payroll screens.
3. Watch Hikari pool usage (single instance, in-memory rate limiter).
4. Lazy-load face-api (AUD-006).

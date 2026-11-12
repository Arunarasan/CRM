# Workflow — Attendance to Payslip

| # | Step | Who | Where | What happens |
|---|---|---|---|---|
| 1 | **Set up employee** | HR / admin | Workforce → People | Profile, wage, hourly rate or monthly salary, attendance method (GEO / OFFICE_DEVICE / ANY), login account. |
| 2 | **Punch in/out** | Employee | Portal Home / Attendance, or office kiosk | Multiple sessions a day are added up. Checks (location, device, face) are soft: a failure flags the punch for HR instead of blocking. |
| 3 | **Fix problems** | HR | Attendance → To approve / Fix a time | Approve flagged punches; set missing check-outs. Days with an open past session are **not paid** until fixed. |
| 4 | **Leave** | Employee → HR | Portal Leave → HR Leave | Approved leave is excluded from absence. |
| 5 | **Requests and extras** | Employee → HR | Salary requests, bonuses, deductions, advances/loans | Approved items are absorbed into the next payslip. |
| 6 | **Rewards** | System | Review QR, qualified leads | Google-review rewards and qualified-lead rewards (rate in Website → Settings) are added as automatic lines. |
| 7 | **Make payslips** | HR | Payroll → Pay run | Choose **Hourly** or **Monthly** basis per person; pay comes from attendance hours. |
| 8 | **Edit lines** | HR | Payslip editor | Add named earnings (bonus, incentives, allowances) and deductions (penalty, extra repay). |
| 9 | **Approve** | HR / admin | Pay run | Employee can now see it. |
| 10 | **Pay** | Finance | Pay run → Pay | Marked Paid; posts to the Cash Book; payslip locked. |

**How pay is worked out**
- Standard hours = daily standard hours × 26.
- **Hourly:** regular hours × hourly rate (or monthly salary ÷ standard hours) + overtime.
- **Monthly:** monthly salary ÷ standard hours × regular hours, capped at monthly salary, + overtime.

**Contractors** appear on the pay-run for visibility but are paid through Contractor Bills with their approval ladder.

## Quick Q&A
**Q: A day is missing from the payslip.** Missing check-out; HR sets the time in Attendance.
**Q: Can I regenerate a wrong payslip?** Yes if unpaid: delete or regenerate; related bonuses and requests return to Approved.

-- Payroll rules the admin edits on the HR → Payroll → "Pay rules" tab.
-- Stored in site_settings under the "payroll." prefix (hidden from the public site + Website form).
--   wage basics   : default standard daily hours / working days per month (used when an employee has none)
--   incentives    : per completed project, attendance bonus, performance bonus
-- The per-review and per-qualified-lead rates keep their existing keys (google_review_reward_amount,
-- lead_collected_reward_amount) and are edited from the same screen.

INSERT INTO site_settings (setting_key, setting_value, group_name, label, input_type, display_order, is_deleted, version)
SELECT k, v, 'Payroll', l, 'text', 200, b'0', 0 FROM (
  SELECT 'payroll.default_daily_hours' AS k, '8' AS v, 'Default standard hours per day' AS l UNION ALL
  SELECT 'payroll.default_working_days', '26', 'Default paid working days per month' UNION ALL
  SELECT 'payroll.project_incentive_amount', '0', 'Incentive per completed project (₹)' UNION ALL
  SELECT 'payroll.attendance_bonus_amount', '0', 'Attendance bonus (₹)' UNION ALL
  SELECT 'payroll.attendance_bonus_min_percent', '95', 'Attendance bonus - minimum attendance %' UNION ALL
  SELECT 'payroll.performance_bonus_amount', '0', 'Performance bonus (₹)' UNION ALL
  SELECT 'payroll.performance_bonus_min_score', '80', 'Performance bonus - minimum score'
) t
WHERE NOT EXISTS (SELECT 1 FROM site_settings s WHERE s.setting_key = t.k);

-- One row per (project, employee) already paid a completion incentive, so a project is never paid twice.
CREATE TABLE project_completion_incentives (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    project_id       BIGINT NOT NULL,
    employee_id      BIGINT NOT NULL,
    salary_record_id BIGINT NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_pci_project_employee (project_id, employee_id),
    KEY idx_pci_salary_record (salary_record_id)
);

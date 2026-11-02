-- Work incentives (project / lead / Google review / incentive bonuses) are earned only in a month where the
-- employee was present at least N days AND averaged at least H hours per day attended. 0 = that test is off.
INSERT INTO site_settings (setting_key, setting_value, group_name, label, input_type, display_order, is_deleted, version)
SELECT k, v, 'Payroll', l, 'text', 200, b'0', 0 FROM (
  SELECT 'payroll.incentive_min_days' AS k, '20' AS v, 'Work incentives - minimum days present in the month' AS l UNION ALL
  SELECT 'payroll.incentive_avg_hours', '7', 'Work incentives - minimum average hours per day'
) t
WHERE NOT EXISTS (SELECT 1 FROM site_settings s WHERE s.setting_key = t.k);

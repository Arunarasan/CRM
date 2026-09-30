-- Google-review rewards: verify which employee's QR produced a real Google review, then pay a
-- reward that flows into the payroll bonus/incentive engine.
--  * New columns on employee_reviews track verification + the reward bonus raised for it.
--  * google_review_reward_amount: the reward paid per verified Google review (admin-editable).

ALTER TABLE employee_reviews
    ADD COLUMN google_verified      BIT(1)         NOT NULL DEFAULT b'0',
    ADD COLUMN google_verified_at   DATETIME(6)    NULL,
    -- The matched Google review id (set when reconciled against the Business Profile API), else NULL.
    ADD COLUMN google_review_id     VARCHAR(255)   NULL,
    -- Reward paid for this review + the bonus row it created (prevents paying twice).
    ADD COLUMN reward_amount        DECIMAL(15,2)  NULL,
    ADD COLUMN reward_bonus_id      BIGINT         NULL;

-- Reward amount per verified Google review (shown in the CRM Website › Settings form).
INSERT INTO site_settings (setting_key, setting_value, group_name, label, input_type, display_order, is_deleted, version)
SELECT 'google_review_reward_amount', '0', 'General', 'Reward per Google Review (₹)', 'text', 91, b'0', 0
WHERE NOT EXISTS (SELECT 1 FROM site_settings WHERE setting_key = 'google_review_reward_amount');

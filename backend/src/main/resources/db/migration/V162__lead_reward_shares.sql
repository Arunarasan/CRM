-- Qualified-lead reward is split between the lead owner and the employee who completed the lead's
-- Collect Requirement task. One row per (lead, person) paid, so nobody is paid twice for a lead.
CREATE TABLE lead_reward_shares (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    lead_id          BIGINT NOT NULL,
    user_id          BIGINT NOT NULL,
    salary_record_id BIGINT NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_lrs_lead_user (lead_id, user_id),
    KEY idx_lrs_salary_record (salary_record_id),
    KEY idx_lrs_user (user_id)
);

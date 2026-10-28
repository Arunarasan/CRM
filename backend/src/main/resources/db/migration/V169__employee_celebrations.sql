-- "Gifts": one celebration card per time money is given to an employee (bonus, incentive, allowance, salary).
-- Shown in the employee portal's Gifts tab. (source_type, source_id, employee_id) is unique so the same
-- payment can never celebrate twice. Backfilled from the last 90 days as already-opened cards, so the tab
-- isn't empty on day one but nobody gets a pile of surprise confetti.
CREATE TABLE employee_celebrations (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id   BIGINT        NOT NULL,
    kind          VARCHAR(20)   NOT NULL,            -- BONUS | INCENTIVE | ALLOWANCE | SALARY
    title         VARCHAR(200)  NOT NULL,
    note          TEXT          NULL,                -- HR's message, shown on the card
    amount        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    source_type   VARCHAR(30)   NOT NULL,
    source_id     BIGINT        NOT NULL,
    reward_date   DATE          NOT NULL,
    opened        BIT           NOT NULL DEFAULT 0,
    created_at    DATETIME      NULL,
    updated_at    DATETIME      NULL,
    created_by    VARCHAR(255)  NULL,
    updated_by    VARCHAR(255)  NULL,
    deleted_by    VARCHAR(255)  NULL,
    deleted_at    DATETIME      NULL,
    is_deleted    BIT           NOT NULL DEFAULT 0,
    version       BIGINT        NULL DEFAULT 0,
    CONSTRAINT fk_celebration_employee FOREIGN KEY (employee_id) REFERENCES employees(id),
    UNIQUE KEY uq_celebration_source (employee_id, source_type, source_id),
    INDEX idx_celebration_employee (employee_id, opened)
);

INSERT INTO employee_celebrations
    (employee_id, kind, title, note, amount, source_type, source_id, reward_date, opened, created_at, is_deleted, version)
SELECT b.employee_id, 'BONUS', CONCAT(REPLACE(LOWER(b.bonus_type), '_', ' '), ' bonus'), b.reason, b.amount, 'BONUS', b.id,
       COALESCE(DATE(b.decided_at), b.award_date, DATE(b.created_at)), 1, NOW(), 0, 0
FROM employee_bonuses b
WHERE b.status IN ('APPROVED', 'PAID') AND b.is_deleted = 0 AND b.amount > 0
  AND COALESCE(DATE(b.decided_at), b.award_date, DATE(b.created_at)) >= DATE_SUB(CURDATE(), INTERVAL 90 DAY);

INSERT INTO employee_celebrations
    (employee_id, kind, title, note, amount, source_type, source_id, reward_date, opened, created_at, is_deleted, version)
SELECT s.employee_id, 'SALARY', CONCAT('Salary for ', LPAD(s.month, 2, '0'), '/', s.year), NULL, s.net_salary, 'SALARY', s.id,
       s.payment_date, 1, NOW(), 0, 0
FROM salary_records s
WHERE s.status = 'PAID' AND s.payment_date IS NOT NULL AND s.net_salary > 0
  AND s.payment_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY);

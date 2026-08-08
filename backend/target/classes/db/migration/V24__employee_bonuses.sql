-- Employee Bonuses: admin-awarded bonuses (project-completion, performance, festival, other).
-- PENDING -> APPROVED -> PAID. Surfaces in the employee's self-service account. Additive.

CREATE TABLE employee_bonuses (
    id             BIGINT AUTO_INCREMENT PRIMARY KEY,
    employee_id    BIGINT       NOT NULL,
    bonus_type     VARCHAR(40)  NOT NULL,
    amount         DECIMAL(15,2) NOT NULL,
    project_id     BIGINT       NULL,
    reason         TEXT         NULL,
    award_date     DATE         NULL,
    status         VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    awarded_by_id  BIGINT       NULL,
    approved_by_id BIGINT       NULL,
    decided_at     DATETIME     NULL,
    paid_at        DATETIME     NULL,
    created_at     DATETIME     NULL,
    updated_at     DATETIME     NULL,
    created_by     VARCHAR(255) NULL,
    updated_by     VARCHAR(255) NULL,
    deleted_by     VARCHAR(255) NULL,
    deleted_at     DATETIME     NULL,
    is_deleted     BIT          NOT NULL DEFAULT 0,
    version        BIGINT       NULL DEFAULT 0,
    CONSTRAINT fk_empbonus_employee    FOREIGN KEY (employee_id)    REFERENCES employees(id),
    CONSTRAINT fk_empbonus_project     FOREIGN KEY (project_id)     REFERENCES projects(id),
    CONSTRAINT fk_empbonus_awarded_by  FOREIGN KEY (awarded_by_id)  REFERENCES users(id),
    CONSTRAINT fk_empbonus_approved_by FOREIGN KEY (approved_by_id) REFERENCES users(id),
    INDEX idx_empbonus_employee (employee_id),
    INDEX idx_empbonus_status (status)
);

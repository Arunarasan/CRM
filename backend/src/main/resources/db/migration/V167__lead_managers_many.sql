-- A lead can have several managers (e.g. the people holding its different tasks).
CREATE TABLE lead_managers (
    lead_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    PRIMARY KEY (lead_id, user_id),
    CONSTRAINT fk_lm_lead FOREIGN KEY (lead_id) REFERENCES leads(id),
    CONSTRAINT fk_lm_user FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO lead_managers (lead_id, user_id)
SELECT id, lead_manager_id FROM leads WHERE lead_manager_id IS NOT NULL;

ALTER TABLE leads
    DROP FOREIGN KEY fk_leads_lead_manager,
    DROP INDEX idx_leads_lead_manager,
    DROP COLUMN lead_manager_id;

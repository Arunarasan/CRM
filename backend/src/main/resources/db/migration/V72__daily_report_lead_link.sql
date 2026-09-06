-- Employee daily reports can now be tied to a lead (in addition to a project/task), so a
-- field report about a specific enquiry surfaces on that lead's page and activity log.
ALTER TABLE daily_reports ADD COLUMN lead_id BIGINT NULL;
ALTER TABLE daily_reports
    ADD CONSTRAINT fk_dr_lead FOREIGN KEY (lead_id) REFERENCES leads(id);
CREATE INDEX idx_dr_lead ON daily_reports(lead_id);

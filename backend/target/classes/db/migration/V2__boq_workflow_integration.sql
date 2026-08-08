-- Adds Lead/SiteVisit traceability and revision/link metadata to boqs.
-- All additions are nullable (or default-backed) so no existing row is affected.

ALTER TABLE boqs ADD COLUMN lead_id BIGINT NULL;
ALTER TABLE boqs ADD CONSTRAINT fk_boqs_lead FOREIGN KEY (lead_id) REFERENCES leads(id);

ALTER TABLE boqs ADD COLUMN site_visit_id BIGINT NULL;
ALTER TABLE boqs ADD CONSTRAINT fk_boqs_site_visit FOREIGN KEY (site_visit_id) REFERENCES site_visits(id);

ALTER TABLE boqs ADD COLUMN revision_reason TEXT NULL;

ALTER TABLE boqs ADD COLUMN link_status VARCHAR(20) NOT NULL DEFAULT 'LINKED';

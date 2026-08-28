-- Capture who referred a lead, recorded at creation when Lead Source = "Referral".
--
-- A referral can come from an existing customer, a staff member (employee), or an external
-- person ("Other"). We store the referrer type plus optional links to the referring customer
-- or employee, and free-text name/contact/notes for the "Other" case (or as a display label).
-- All nullable — only referral leads populate these; every other lead leaves them empty.

ALTER TABLE leads
    ADD COLUMN referral_type            VARCHAR(30)  NULL,
    ADD COLUMN referred_by_customer_id  BIGINT       NULL,
    ADD COLUMN referred_by_employee_id  BIGINT       NULL,
    ADD COLUMN referrer_name            VARCHAR(200) NULL,
    ADD COLUMN referrer_contact         VARCHAR(50)  NULL,
    ADD COLUMN referral_notes           TEXT         NULL;

ALTER TABLE leads
    ADD CONSTRAINT fk_lead_referred_customer
        FOREIGN KEY (referred_by_customer_id) REFERENCES customers (id),
    ADD CONSTRAINT fk_lead_referred_employee
        FOREIGN KEY (referred_by_employee_id) REFERENCES users (id);

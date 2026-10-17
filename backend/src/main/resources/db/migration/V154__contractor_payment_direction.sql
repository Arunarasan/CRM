-- Two-way contractor money: OUT = we paid the contractor, IN = the contractor paid us
-- (advance refund, material recovery, penalty settled in cash). Existing rows are all OUT.
ALTER TABLE contractor_payments
    ADD COLUMN direction VARCHAR(10) NOT NULL DEFAULT 'OUT';

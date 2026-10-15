-- Employee self-service profile edits now cover name + bank/statutory details too.
-- Still approval-gated: values sit here until an admin approves, then copy onto the employee.
ALTER TABLE profile_change_requests
    ADD COLUMN proposed_first_name   VARCHAR(100) NULL,
    ADD COLUMN proposed_last_name    VARCHAR(100) NULL,
    ADD COLUMN proposed_bank_account VARCHAR(50)  NULL,
    ADD COLUMN proposed_ifsc         VARCHAR(20)  NULL,
    ADD COLUMN proposed_pf_number    VARCHAR(50)  NULL,
    ADD COLUMN proposed_esi_number   VARCHAR(50)  NULL,
    ADD COLUMN proposed_uan          VARCHAR(50)  NULL;

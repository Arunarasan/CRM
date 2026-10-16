-- Aadhaar / PAN / bank account / IFSC are now stored encrypted (AES-256-GCM, "enc:v1:" + base64),
-- which is far longer than the plain values. Widen the columns; PiiEncryptionBackfill encrypts the
-- existing plain-text rows on the next start-up.
ALTER TABLE workforce
    MODIFY COLUMN aadhaar_number VARCHAR(512) NULL,
    MODIFY COLUMN pan_number VARCHAR(512) NULL;

ALTER TABLE employees
    MODIFY COLUMN bank_account VARCHAR(512) NULL,
    MODIFY COLUMN ifsc VARCHAR(512) NULL;

ALTER TABLE contractors
    MODIFY COLUMN pan VARCHAR(512) NULL,
    MODIFY COLUMN bank_account_number VARCHAR(512) NULL,
    MODIFY COLUMN bank_ifsc VARCHAR(512) NULL;

ALTER TABLE suppliers
    MODIFY COLUMN pan VARCHAR(512) NULL,
    MODIFY COLUMN bank_account_number VARCHAR(512) NULL,
    MODIFY COLUMN bank_ifsc VARCHAR(512) NULL;

ALTER TABLE profile_change_requests
    MODIFY COLUMN proposed_bank_account VARCHAR(512) NULL,
    MODIFY COLUMN proposed_ifsc VARCHAR(512) NULL;

ALTER TABLE customers
    MODIFY COLUMN pan_number VARCHAR(512) NULL;

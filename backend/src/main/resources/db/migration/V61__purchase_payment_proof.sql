-- Payment proof: a screenshot of the bank/UPI transfer or a scanned receipt, uploaded when
-- recording a supplier payment on the order.

ALTER TABLE purchase_payments
    ADD COLUMN proof_url VARCHAR(500) NULL;

-- BLK-006 fix: atomic allocation of financial document numbers.
--
-- Invoice/payment/credit-debit-note/refund numbers were minted as prefix + (max(id) + 1),
-- which is not atomic: two concurrent creates read the same max and mint the same number.
-- With the UNIQUE constraints now on those columns, that collision surfaces as a 500 instead
-- of a silent duplicate. This counter table lets DocumentNumberService allocate each number
-- under a short row lock in its own transaction, so allocation is serialized and gap-tolerant
-- (a rolled-back create merely skips a number) without ever colliding.
CREATE TABLE document_counters (
    counter_key VARCHAR(40) NOT NULL PRIMARY KEY,
    next_value  BIGINT      NOT NULL
) ENGINE=InnoDB;

-- Seed each counter from the current max id of its table so newly minted numbers continue
-- past every number already issued (the old scheme was effectively number == row id).
INSERT INTO document_counters (counter_key, next_value) VALUES
    ('INVOICE', COALESCE((SELECT MAX(id) FROM invoices), 0)),
    ('PAYMENT', COALESCE((SELECT MAX(id) FROM customer_payments), 0)),
    ('NOTE',    COALESCE((SELECT MAX(id) FROM credit_debit_notes), 0)),
    ('REFUND',  COALESCE((SELECT MAX(id) FROM refunds), 0));

-- Customer-facing quotation numbers: replace the old timestamp style (QT-1791006680515, and its
-- revisions QT-1791006680515-v2) with a short sequential number from the row id (QT-000012).
-- New quotations get this format from QuotationService.assignNumber.

-- Leads keep a copy of their quotation number — update it first, while the old value still matches.
UPDATE leads l
  JOIN quotations q ON l.quotation_number = q.quotation_number
   SET l.quotation_number = CONCAT('QT-', LPAD(q.id, 6, '0'))
 WHERE q.quotation_number REGEXP '^QT-[0-9]{12,}(-v[0-9]+)?$';

UPDATE quotations
   SET quotation_number = CONCAT('QT-', LPAD(id, 6, '0'))
 WHERE quotation_number REGEXP '^QT-[0-9]{12,}(-v[0-9]+)?$';

-- Old quotations without a validity date: 14 days from the quotation date (the standard terms).
UPDATE quotations
   SET expiry_date = DATE_ADD(quotation_date, INTERVAL 14 DAY)
 WHERE expiry_date IS NULL AND quotation_date IS NOT NULL;

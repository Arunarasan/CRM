-- Retro-tag past counter-sale walk-ins that V70 defaulted to PROJECT_CLIENT.
--
-- A customer is reclassified to WALK_IN only when their ENTIRE footprint is counter sales:
--   * has at least one active COUNTER_SALE invoice, AND
--   * has NO other (non counter-sale) invoice, AND
--   * has no project, no quotation, and is not the conversion target of any lead.
-- This deliberately leaves existing project clients who happened to also buy over the
-- counter as PROJECT_CLIENT — we never demote a real client.

UPDATE customers c
SET c.customer_segment = 'WALK_IN'
WHERE c.customer_segment = 'PROJECT_CLIENT'
  AND c.is_deleted = 0
  AND EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.customer_id = c.id AND i.is_deleted = 0
          AND i.invoice_type = 'COUNTER_SALE'
      )
  AND NOT EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.customer_id = c.id AND i.is_deleted = 0
          AND (i.invoice_type IS NULL OR i.invoice_type <> 'COUNTER_SALE')
      )
  AND NOT EXISTS (
        SELECT 1 FROM projects p
        WHERE p.customer_id = c.id AND p.is_deleted = 0
      )
  AND NOT EXISTS (
        SELECT 1 FROM quotations q
        WHERE q.customer_id = c.id AND q.is_deleted = 0
      )
  AND NOT EXISTS (
        SELECT 1 FROM leads l
        WHERE l.converted_customer_id = c.id AND l.is_deleted = 0
      );

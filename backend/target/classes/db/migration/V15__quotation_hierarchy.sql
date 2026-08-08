-- House-structure quotation: carry the Floor -> Room -> Category -> Item hierarchy from the linked
-- BOQ onto quotation_items, plus per-item material/labour split (for room/floor roll-ups),
-- measurement dims, optional material-spec annotations, and a per-item additional charge.
-- All columns nullable/defaulted so existing flat quotations load unchanged (their null-floor/
-- null-room lines render under a "General -> General Room" bucket in the UI).
ALTER TABLE quotation_items
    ADD COLUMN floor_name         VARCHAR(100) NULL,
    ADD COLUMN room_name          VARCHAR(100) NULL,
    ADD COLUMN floor_order        INT NOT NULL DEFAULT 0,
    ADD COLUMN room_order         INT NOT NULL DEFAULT 0,
    ADD COLUMN item_order         INT NOT NULL DEFAULT 0,
    ADD COLUMN material_cost      DECIMAL(15, 2) NULL,
    ADD COLUMN labour_cost        DECIMAL(15, 2) NULL,
    ADD COLUMN length             DECIMAL(15, 2) NULL,
    ADD COLUMN width              DECIMAL(15, 2) NULL,
    ADD COLUMN height             DECIMAL(15, 2) NULL,
    ADD COLUMN area               DECIMAL(15, 2) NULL,
    ADD COLUMN brand              VARCHAR(255) NULL,
    ADD COLUMN specification      TEXT NULL,
    ADD COLUMN color              VARCHAR(100) NULL,
    ADD COLUMN thickness          VARCHAR(50) NULL,
    ADD COLUMN grade              VARCHAR(50) NULL,
    ADD COLUMN estimated_days     INT NULL,
    ADD COLUMN assigned_contractor VARCHAR(255) NULL,
    ADD COLUMN additional_charges DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Header-level roll-ups for the quotation Grand Summary (material / labour / additional charges).
-- Computed by QuotationService.recalculateTotals; default 0 for existing rows until next save.
ALTER TABLE quotations
    ADD COLUMN material_total           DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN labour_total             DECIMAL(15, 2) NOT NULL DEFAULT 0,
    ADD COLUMN additional_charges_total DECIMAL(15, 2) NOT NULL DEFAULT 0;

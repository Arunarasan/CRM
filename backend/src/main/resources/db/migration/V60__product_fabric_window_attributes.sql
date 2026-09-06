-- Inventory Material Master enrichment for the curtains/blinds/fabric catalogue.
-- Adds media (gallery), fabric/cloth specifications, and window-suitability + design
-- attributes to the products table. List columns are newline-delimited TEXT to match
-- StringListConverter (same convention as the website materials table).

ALTER TABLE products
    ADD COLUMN image_urls           TEXT         NULL,
    ADD COLUMN fabric_composition   VARCHAR(150) NULL,
    ADD COLUMN fabric_width         VARCHAR(60)  NULL,
    ADD COLUMN gsm                  INT          NULL,
    ADD COLUMN pattern              VARCHAR(120) NULL,
    ADD COLUMN color                VARCHAR(80)  NULL,
    ADD COLUMN color_family         VARCHAR(60)  NULL,
    ADD COLUMN available_sizes      TEXT         NULL,
    ADD COLUMN product_type         VARCHAR(80)  NULL,
    ADD COLUMN suitable_window_types TEXT        NULL,
    ADD COLUMN mounting_type        VARCHAR(80)  NULL,
    ADD COLUMN opacity              VARCHAR(60)  NULL,
    ADD COLUMN suitable_rooms       TEXT         NULL,
    ADD COLUMN design_style         VARCHAR(80)  NULL,
    ADD COLUMN structure_notes      TEXT         NULL;

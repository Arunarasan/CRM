-- What the lead is enquiring about: a catalog PRODUCT, a SERVICE, or OTHER.
-- requirement_service holds the chosen service name(s) (comma-separated); requirement_other is
-- the free-text description when the enquiry is "Other".
ALTER TABLE leads ADD COLUMN enquiry_type VARCHAR(20) NULL;
ALTER TABLE leads ADD COLUMN requirement_service VARCHAR(1000) NULL;
ALTER TABLE leads ADD COLUMN requirement_other VARCHAR(500) NULL;

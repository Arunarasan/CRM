-- Lost-lead win-back: the date to try a lost lead again (a "Win-back" reminder task is due that day) and
-- a short note on what to try. Cleared when the lead is reopened.
ALTER TABLE leads ADD COLUMN win_back_date DATE NULL;
ALTER TABLE leads ADD COLUMN win_back_note VARCHAR(500) NULL;
CREATE INDEX idx_lead_win_back ON leads (win_back_date);

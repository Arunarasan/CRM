-- Optional phone number on a login account so users can sign in with phone instead of email.
ALTER TABLE users ADD COLUMN phone VARCHAR(20) NULL;
CREATE INDEX idx_user_phone ON users (phone);

-- Order remarks can carry a voice note.
ALTER TABLE bundle_events ADD COLUMN audio_url VARCHAR(1000) NULL;

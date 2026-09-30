-- Remarks on a task can now be a voice note as well as text. Store the uploaded audio clip's URL
-- on the comment; text stays in `content` (a short label when the remark is voice-only).
ALTER TABLE task_comments ADD COLUMN audio_url VARCHAR(500) NULL;

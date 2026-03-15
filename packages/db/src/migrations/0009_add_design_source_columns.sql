ALTER TABLE workspace_settings
  ADD COLUMN figma_access_token TEXT,
  ADD COLUMN figma_file_key TEXT,
  ADD COLUMN figma_webhook_id TEXT,
  ADD COLUMN figma_webhook_passcode TEXT,
  ADD COLUMN penpot_instance_url TEXT,
  ADD COLUMN penpot_access_token TEXT;

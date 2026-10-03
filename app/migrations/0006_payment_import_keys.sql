ALTER TABLE payments ADD COLUMN import_key TEXT;

CREATE UNIQUE INDEX payments_import_key_unique_idx
  ON payments(import_key COLLATE NOCASE)
  WHERE import_key IS NOT NULL;

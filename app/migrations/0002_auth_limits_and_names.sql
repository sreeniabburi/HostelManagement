CREATE UNIQUE INDEX hostels_name_unique_idx ON hostels(name COLLATE NOCASE);

CREATE TABLE login_limits (
  identity_hash TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL,
  window_started_at INTEGER NOT NULL,
  locked_until INTEGER NOT NULL
);

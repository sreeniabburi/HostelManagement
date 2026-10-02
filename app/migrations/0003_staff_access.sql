ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1));

CREATE TABLE user_hostels (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hostel_id TEXT NOT NULL REFERENCES hostels(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, hostel_id)
);

CREATE INDEX user_hostels_hostel_idx ON user_hostels(hostel_id, user_id);

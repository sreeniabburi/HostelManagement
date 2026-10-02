CREATE UNIQUE INDEX guests_hostel_email_unique_idx ON guests(hostel_id, email COLLATE NOCASE);

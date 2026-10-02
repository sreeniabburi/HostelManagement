CREATE TABLE guests (
  id TEXT PRIMARY KEY,
  hostel_id TEXT NOT NULL REFERENCES hostels(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile TEXT NOT NULL,
  address TEXT NOT NULL,
  emergency_contact TEXT NOT NULL,
  identity_proof TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX guests_hostel_name_idx ON guests(hostel_id, name);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  hostel_id TEXT NOT NULL REFERENCES hostels(id) ON DELETE RESTRICT,
  guest_id TEXT NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  bed_id TEXT NOT NULL REFERENCES beds(id) ON DELETE RESTRICT,
  arrival_date TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Reserved', 'Checked in', 'Checked out', 'Cancelled')),
  total_rent_cents INTEGER NOT NULL CHECK (total_rent_cents >= 0),
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (departure_date > arrival_date)
);

CREATE INDEX bookings_hostel_dates_idx ON bookings(hostel_id, arrival_date, departure_date, status);
CREATE INDEX bookings_bed_dates_idx ON bookings(bed_id, arrival_date, departure_date, status);
CREATE INDEX bookings_guest_idx ON bookings(guest_id, created_at);

CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  hostel_id TEXT NOT NULL REFERENCES hostels(id) ON DELETE RESTRICT,
  booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  method TEXT NOT NULL CHECK (method IN ('Cash', 'UPI', 'Bank transfer', 'Other')),
  received_on TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX payments_hostel_received_idx ON payments(hostel_id, received_on);
CREATE INDEX payments_booking_idx ON payments(booking_id, created_at);

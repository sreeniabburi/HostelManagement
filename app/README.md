# HostelDesk application

## Local development

From this directory, install dependencies, apply local D1 migrations, and start Vite:

```powershell
npm install
npm run db:migrate:local
npm run dev
```

Run `npm run build` and `npm run lint` to verify changes. Remote migrations and deployment are described in the repository's [deployment guide](../DEPLOYMENT.md).

## Importing existing hostel data

Sign in as an administrator and open **Data import**. On a new workspace without hostels, use **Import existing data**. Download the linked CSV templates, replace the sample row while keeping the headers, select the completed files, and run **Validate files**. The importer checks required values, duplicate/conflicting records, foreign-key references, booking overlaps, and payment totals before allowing an atomic import.

Templates and example relationships:

1. `hostels.csv`: stable `hostel_key`, hostel name, address.
2. `floors.csv`: `hostel_key`, stable `floor_key`, display name and one-based position.
3. `rooms.csv`: hostel/floor keys, room number and sharing capacity.
4. `beds.csv`: hostel/floor keys, room number, bed label and `Vacant` or `Maintenance` status.
5. `guests.csv`: hostel key, stable `guest_key`, contact details and supported identity-proof type.
6. `bookings.csv`: hostel/guest/floor/room/bed references, ISO dates, status and decimal total rent.
7. `payments.csv`: stable, unique `payment_key`, hostel and booking references, decimal amount, supported method, received date and optional note.

The example values are linked across the templates; replace them consistently or remove all sample rows. Upload the related files together. Imports are admin-only and append-only. Existing hostels, floors, rooms, beds, guests, and bookings may be included only when their stored values match exactly; they are reused, never replaced. Each newly imported payment needs a unique `payment_key`; an already-used key is rejected. Any conflict or validation error rejects the complete import. The request is limited to 500 rows and 2 MB. Keep completed spreadsheets secure because they contain guest personal information and payment history. Do not include identity documents, card details, or bank credentials.

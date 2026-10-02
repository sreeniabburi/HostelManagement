# Hostel Management System

## Project overview

Build a responsive application for managing multiple hostels under one ownership. The system helps authorized administrators and staff manage hostel configuration, guest records, reservations, room and bed occupancy, rent balances, payment records, email notifications, and operational reports.

The application records payments received outside the system. It does not collect or process money.

## Goals

- Manage multiple hostels from one application, with consolidated views for authorized administrators.
- Make reservations, check-ins, bed assignments, and checkouts easy to track.
- Keep room and bed availability accurate and prevent overlapping assignments.
- Calculate rent according to configurable rules for each hostel and sharing option.
- Track rent due, payments recorded, and outstanding balances.
- Send guests payment confirmations and overdue-rent reminders by email.
- Provide useful operational and financial reporting on desktop and mobile.

## Users and access

### Admin

- Manage hostel profiles and access to each hostel.
- Configure floors, rooms, bed counts, sharing options, rent rules, due dates, and reminder schedules.
- Manage staff accounts and permissions.
- View reports and data across all hostels, subject to assigned access.
- Review booking, payment, and notification history.

### Staff

- Access only the hostels assigned by an administrator.
- Enter guest details and create reservations.
- Check guests in, assign or update beds, and record actual checkout dates.
- Record payments received outside the app.
- View relevant guest, booking, occupancy, and payment information for assigned hostels.

Enforce permissions for both the user interface and the operations that read or change data.

## Functional requirements

### Multi-hostel configuration

- Support multiple hostels under one ownership.
- Provide authorized consolidated views and hostel-specific views.
- Allow administrators to assign staff access per hostel.
- Configure floors, rooms per floor, beds per room, and sharing type.
- Validate configured sharing capacity against the number of beds in a room.

### Rent

- Support 1-, 2-, 3-, and 4-sharing options.
- Let administrators configure rates and rent calculation rules per hostel.
- Display rent estimates for reservations and the rent due for a stay.
- Apply the hostel's configured rules when the actual checkout date differs from the planned date.
- Configure rent due dates and overdue reminder schedules per hostel.
- Keep rent charged, payments recorded, and outstanding balance distinguishable in the interface and reports.

Exact proration, billing-period, deposit, discount, tax, and late-fee policies are not prescribed here; they must be represented by the hostel's configured rent rules where applicable.

### Guests and bookings

- Staff enter guest details in the application.
- Collect guest name, email address, mobile number, address, emergency contact number, and identity-proof type.
- Identity-proof type options: Aadhaar card, driving licence, voter ID, and PAN card.
- Do not require or store an uploaded identity document.
- Support future reservations as well as check-in and checkout.
- Record hostel, room, bed, sharing option, planned stay dates, actual checkout date, booking status, rent terms, and booking history.
- Prevent overlapping reservations or stays for the same bed.
- Keep a guest's prior booking history after checkout.
- Mark rooms or beds unavailable when required for maintenance or other operational reasons.

### Occupancy

- Track beds as occupied, vacant, reserved, or under maintenance.
- Show occupancy and availability by hostel, floor, room, and bed.
- Update bed availability based on the booking lifecycle and actual checkout date.

### Payments and balances

- Staff record payments received outside the app; the app must not initiate or process payments.
- Provide a **Payment Received** action on relevant guest or booking views.
- For each payment, record amount, method (UPI or cash), received date, recording staff member, and optional reference or note.
- Support partial payments.
- Update totals and outstanding balances after a payment is saved.
- Preserve payment history and make recorded payments reviewable.
- Do not represent a payment as saved if the save operation fails.

### Email notifications

- Send a payment confirmation after a payment record is successfully saved.
- Include amount received, payment method, date, and remaining balance in the confirmation.
- Show the notification status and make failed sends visible to staff for follow-up.
- Send overdue-rent reminders according to each hostel's configured schedule.
- Do not send an overdue reminder when no balance is outstanding.
- Record notification status and send time.

### Reports

Provide reports for:

- Occupancy and vacant/reserved beds.
- Bookings and arrivals/departures.
- Rent charged, payments recorded, and outstanding balances.
- Overdue rent.

Reports should be filterable by hostel and date range. Consolidated reports should be available only to users with appropriate access. Provide exportable report results.

## Quality requirements

- Responsive, accessible interface suitable for desktop and mobile use.
- Validate form inputs and show actionable error messages.
- Provide visible loading, empty, success, and failure states.
- Protect guest and payment information with authentication and role-based access.
- Keep an auditable history of important booking, bed assignment, rent configuration, payment, and notification changes.
- Avoid storing identity-document images or payment credentials.

## Out of scope

- Online checkout, payment gateway integration, or in-app payment processing.
- Uploading identity documents.
- Guest self-service registration or booking submission; staff enter guest details.

## Acceptance criteria

- Authorized admins can create multiple hostels and configure access for staff.
- Room and bed configuration reflects the selected hostel's floors, rooms, beds, and sharing options.
- A bed cannot be assigned to overlapping reservations or stays.
- Occupancy views correctly distinguish occupied, vacant, reserved, and maintenance beds.
- Rent calculations use the applicable hostel's configured rules.
- A saved partial or full payment updates paid and outstanding amounts accurately.
- A payment confirmation is attempted only after the payment has been saved; send failures are visible.
- Overdue reminders respect the hostel's schedule and are not sent when the balance is zero.
- Staff cannot access hostels or administrative operations they are not authorized to use.
- Core workflows are usable on mobile and desktop.

## Validation expectations

Test rent calculations and checkout adjustments, booking-date conflicts, bed availability, payment balances, role permissions, report filters, and email notification conditions. Include setup instructions and representative development data when an implementation is established.

# Hostel Management System — Design Specification

## Design principles

- Prioritize fast, clear workflows for staff handling arrivals, room assignments, and payment recording.
- Make hostel context and user access visible throughout the application.
- Distinguish rent charged, payments recorded, and outstanding balances.
- Use explicit labels alongside color to communicate status.
- Support both desktop and mobile without hiding essential actions on smaller screens.
- Confirm consequential actions and show success or failure clearly.

## Visual direction

Use a clean, modern hospitality aesthetic with a calm blue and teal palette, neutral surfaces, readable typography, and generous spacing. Use consistent status badges, accessible contrast, and touch-friendly controls.

## Application navigation

### Desktop

Use a persistent sidebar and a top bar. The top bar contains the current hostel selector, notifications, and user menu. Admins may select an authorized **All hostels** view; staff see only assigned hostels.

Primary navigation:

1. Dashboard
2. Bookings
3. Guests
4. Rooms & Beds
5. Payments
6. Reports
7. Settings (authorized admins)

### Mobile

Use a compact top bar and a bottom navigation for **Home**, **Bookings**, **Rooms**, and **Guests**. Provide a prominent add/action control for common tasks. Payments, reports, and settings are available from a **More** destination. Use full-width forms and sticky primary actions where helpful.

## Shared layout and components

- Page title and contextual hostel selector.
- Searchable and filterable tables on desktop; stacked cards on mobile.
- Summary metric cards with clear units and date/hostel context.
- Status badges with text and color.
- Reusable form fields, date selectors, confirmation dialogs, and validation messages.
- Empty, loading, success, and failure states.
- Accessible actions with adequate touch targets and keyboard focus indicators.

## Screen specifications

### 1. Dashboard

**Purpose:** Give staff a quick operational overview and direct access to the next task.

**Content:**

- Occupancy, vacant beds, rent collected, and outstanding balance summary.
- Today's arrivals and departures.
- Occupancy breakdown by floor or room.
- Overdue balances requiring follow-up.
- Quick actions: **New Booking**, **Check In**, and **Payment Received**.

Each summary and list should link to a suitably filtered detail view. Metrics respect the selected hostel and user permissions.

```text
[Greeting]                                     [Hostel selector]
[Occupancy] [Vacant beds] [Rent collected] [Outstanding]
[Today's arrivals]                     [Today's departures]
[Occupancy by floor / room]            [Overdue balances]
[New Booking] [Check In] [Payment Received]
```

### 2. Bookings list

**Purpose:** Find and manage reservations and stays.

**Controls:** Search by guest name, mobile number, or booking reference; filter by hostel, date range, and status.

**Desktop columns:** Guest, hostel/room/bed, stay dates, status, balance, and view/action.

**Mobile cards:** Guest name, status, stay dates, room/bed, balance, and the next available action.

Use these statuses: **Reserved**, **Checked in**, **Checked out**, and **Cancelled**.

### 3. Create booking

Use a guided form or clearly separated steps:

1. Select hostel and planned stay dates.
2. Choose a sharing option and available room/bed.
3. Enter guest details.
4. Review rent estimate and booking summary.
5. Save the reservation.

Collect guest name, email, mobile number, address, emergency contact number, and identity-proof type (Aadhaar card, driving licence, voter ID, or PAN card). Do not request an identity-document upload.

Show availability before assignment and prevent overlapping bed reservations. Explain conflicts and unavailable capacity in plain language. Calculate displayed rent according to the selected hostel's configured rules.

### 4. Booking detail

Show guest, hostel, room, bed, sharing option, planned dates, actual checkout date when present, rent terms, payment summary, and booking history.

Available actions depend on booking status and permissions: **Edit Reservation**, **Check In**, **Change Bed**, **Check Out**, and **Cancel**. Confirm cancellation and other consequential changes. On checkout, staff enter the actual checkout date; rent follows the hostel's configured rules and the bed is released accordingly.

### 5. Rooms & Beds

**Purpose:** Show capacity and availability visually.

Provide filters for hostel, floor, date, and status. Organize the view by floor, then room, with beds within each room.

```text
[Rooms & Beds] [Hostel] [Floor] [Date] [Status]
[Floor 1 — occupancy summary]
[Room 101 — 2-sharing] [Bed 1: Occupied] [Bed 2: Vacant]
[Room 102 — 4-sharing] [Bed 1: Reserved] ... [Bed 4: Vacant]
```

Bed statuses: **Occupied**, **Vacant**, **Reserved**, and **Maintenance**. Selecting a bed opens its booking or availability details. Admin configuration should flag a sharing type that exceeds a room's bed count.

### 6. Guest profile

Show guest identity and contact details, emergency contact, identity-proof type, current or upcoming booking, rent summary, booking history, and payment history. Keep personal information visible only to users authorized for that hostel.

### 7. Record payment

Provide a **Payment Received** action on guest and booking details.

```text
[Payment Received]
Guest: [Name]                       Outstanding: [Amount]
Amount received: [________]
Method: ( ) Cash   ( ) UPI
Received date: [________]          Reference / note: [Optional]
                                      [Cancel] [Save payment]
```

Validate that the amount is positive and support partial payments. This records an off-app payment; it does not process money. On successful save, update the balance and send an email confirmation with amount, method, date, and remaining balance. Show whether the email was sent or failed; make failures visible for staff follow-up.

### 8. Payments and balances

Show payment records with guest, hostel, amount, method, date, recorded-by, and confirmation-email status. Filter by hostel, date range, method, and email status. Show outstanding balances and overdue state based on hostel rules. Link each record to the relevant guest or booking.

Clearly label **rent charged**, **payments recorded**, and **outstanding**; never imply that the app processed a payment.

### 9. Reports

Provide occupancy, available beds, bookings, rent charged, payments recorded, outstanding balances, and overdue rent reports. Include hostel and date-range filters, with consolidated views for authorized admins. Support export of filtered results.

### 10. Settings

**Admin settings:**

- Hostel profiles and staff access assignments.
- Floors, rooms per floor, beds per room, and sharing types.
- Rent rates and calculation rules per hostel.
- Rent due dates and overdue-email reminder schedules.
- Email templates and notification status.

**Staff settings:** Profile and sign-out. Staff do not see administrative configuration unless explicitly authorized.

## Key interaction and state requirements

- Clearly communicate loading, empty, validation, save success, and save failure states.
- Do not show a payment as saved if persistence failed.
- Trigger payment confirmation email only after a successful payment save.
- Record notification status and send time; make failure visible.
- Do not send overdue email when the balance is zero.
- Confirm cancellations and other consequential changes.
- Keep availability and occupancy consistent after booking, check-in, bed transfer, cancellation, and actual checkout.

## Responsive behavior

- On desktop, use a persistent sidebar, dense but readable tables, and side-by-side dashboard panels.
- On mobile, use compact navigation, cards instead of wide tables, stacked forms, and prominent primary actions.
- Preserve access to hostel context, booking status, balance, and critical actions at all supported widths.
- Avoid horizontal scrolling for core tasks.

## Design validation checklist

- A staff member can create a future reservation and identify unavailable beds.
- Staff can see current occupancy and distinguish all four bed statuses.
- Staff can record cash or UPI payments and see the updated balance.
- The guest's payment email status is visible after saving.
- Staff can record actual checkout and see the bed become available according to hostel rules.
- Unauthorized hostel and settings data are not exposed.
- Key tasks are operable with touch on mobile and pointer/keyboard on desktop.

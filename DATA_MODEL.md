# Conceptual Data Model

## Status and conventions

This document describes the conceptual model and current implementation. Migrations in `app/migrations/` define users, sessions, hostels, floors, rooms, beds, sign-in limits, guests, bookings, and payment records. Administrators can append a validated set of linked CSV data, including booking and external payment history. Exact matches for existing hostels, floors, rooms, beds, guests, and bookings are reused without modification; conflicts are rejected and new payments have unique import keys to prevent receipt duplication. Current booking totals are entered by staff rather than calculated from a rent rule; email notifications and audit events are not implemented. Stay dates are ISO date-only values interpreted as check-in inclusive and check-out exclusive. Production deployment still needs an explicit business timezone policy.

All records that contain hostel operations must be scoped to the applicable hostel. Monetary amounts should use a precise decimal or integer-minor-unit representation, not binary floating point. Currency should be explicit at the organization or hostel level if multiple currencies may be supported.

## Entities

### Ownership

Represents the operator managing one or more hostels.

- `id`
- `name`
- organization-level settings as required

### Hostel

- `id`, `ownership_id`
- `name`, address, active status
- business timezone
- currency
- rent billing and checkout calculation configuration
- rent due-date and overdue reminder configuration

The exact rent-rule structure is a product decision and must support each hostel's configured rules without hard-coding one billing policy.

### User

- `id`
- name, email, account status
- authentication-provider reference or securely managed credentials

### Role and HostelAccess

Represent role assignments and per-hostel staff access.

- `user_id`, `hostel_id`, `role`
- assignment status and audit timestamps

At minimum support Admin and Staff. Define whether Admin is organization-wide or can be scoped; the product requirements currently describe administrators managing multiple hostels.

### Floor

- `id`, `hostel_id`
- name or number
- display order

### Room

- `id`, `hostel_id`, `floor_id`
- room number/name
- configured sharing option (1, 2, 3, or 4)
- active status

### Bed

- `id`, `hostel_id`, `room_id`
- bed label
- active status

Bed count is represented by the bed records; room sharing configuration must not exceed configured capacity.

### Guest

- `id`, `hostel_id`
- name, email, mobile number, address
- emergency contact number
- identity-proof type enum: Aadhaar card, driving licence, voter ID, PAN card
- created/updated timestamps

Do not include uploaded identity documents. Full identity-document numbers are not currently required and should not be added without explicit approval and privacy review.

### Booking

Represents a reservation or stay. Current date ranges treat check-in as inclusive and check-out as exclusive.

- `id`, `hostel_id`, `guest_id`
- status: reserved, checked in, checked out, or cancelled
- planned check-in and check-out dates/times
- actual check-in and actual checkout dates/times
- sharing option and rent terms snapshot or reference
- created/updated timestamps

Preserve historical booking records after checkout. Define date interval semantics consistently (for example, whether checkout time frees a bed on the same date) before enforcing conflict checks.

### BedAssignment

Associates a booking/stay with a bed over a time interval.

- `id`, `hostel_id`, `booking_id`, `bed_id`
- assignment start and end
- assignment state
- who/when created and changed

Use this entity if guests may change beds or a reservation's bed assignment history must be retained. Prevent overlapping active assignments for the same bed.

### RentRule

- `id`, `hostel_id`
- sharing option
- rate and currency
- effective-from and optional effective-to dates
- billing/proration rule configuration
- active status

Preserve the applicable rate or terms on the booking/charge so later rate changes do not silently alter historical amounts.

### RentCharge

Represents an amount due for a booking or guest.

- `id`, `hostel_id`, `booking_id`, `guest_id`
- charge type and description
- amount and currency
- service period or due date as applicable
- source rent-rule reference or terms snapshot
- created timestamp and creator

The charge ledger makes due amounts auditable and supports varying rent rules. Deposits, discounts, taxes, and late fees remain unspecified and require product decisions before being modeled as charge types.

### PaymentRecord

Represents an immutable record of a payment staff received outside the app. The current initial release does not include a payment correction/reversal workflow.

- `id`, `hostel_id`, `booking_id`, `guest_id`
- amount and currency
- method: cash, UPI, bank transfer, or other
- received date/time
- optional external reference or note
- recorded-by user and created timestamp
- status or reversal reference if correction workflows are supported

This is not a payment transaction or gateway record. Any payment correction should preserve an audit trail.

### PaymentAllocation

Optionally associates a payment with one or more charges when the system needs charge-level settlement.

- `payment_id`, `rent_charge_id`
- allocated amount

If the first release tracks only a guest-level balance, a simpler balance model may be sufficient. Decide allocation behavior (oldest due first, staff-selected, or another rule) before implementation.

### Notification

- `id`, `hostel_id`, `guest_id`
- related booking, payment, or charge reference
- type: payment confirmation or overdue reminder
- recipient address
- status: queued, sent, failed
- attempt count and timestamps
- provider reference/error category where useful

Do not keep unnecessary copies of sensitive email content. Retries must not create duplicate financial records.

### AuditEvent

- `id`, `hostel_id` when applicable
- actor user
- action and entity type/id
- timestamp
- minimal before/after metadata needed for accountability

Avoid copying full personal details or secrets into audit metadata.

### MaintenanceBlock

Represents a room or bed unavailable for operational reasons.

- `id`, `hostel_id`
- target room or bed
- start/end interval
- reason/category
- status and creator

## Relationships

```text
Ownership 1 ── * Hostel
Hostel 1 ── * Floor 1 ── * Room 1 ── * Bed
Hostel * ── * User (through HostelAccess)
Hostel 1 ── * Guest
Guest 1 ── * Booking
Booking 1 ── * BedAssignment * ── 1 Bed
Hostel 1 ── * RentRule
Booking 1 ── * RentCharge
Guest/Booking 1 ── * PaymentRecord
PaymentRecord * ── * RentCharge (optional, through PaymentAllocation)
Guest 1 ── * Notification
Hostel/User 1 ── * AuditEvent
```

## Derived values and integrity rules

- **Room capacity:** count of active beds; reject sharing configurations above capacity.
- **Bed availability:** derive from active reservations/stays, bed maintenance blocks, and the requested date interval.
- **Occupancy:** derive from active bed assignments and booking state.
- **Paid amount:** sum valid recorded payments or allocated payment amounts according to the chosen ledger model.
- **Outstanding amount:** applicable charges plus adjustments minus valid payments/credits, using consistent currency and rounding.
- **Overdue:** outstanding amount greater than zero after the configured due date and according to hostel reminder rules.

Enforce booking and assignment conflicts transactionally to handle concurrent staff actions. Add database-level constraints where supported, in addition to application validation.

## Decisions required before schema implementation

- Booking interval and timezone semantics.
- Guest deduplication and whether guest records are hostel-specific or shared across the ownership.
- Rent periods, proration, effective rate changes, and checkout adjustments.
- Deposits, discounts, taxes, late fees, credits, and corrections.
- Payment allocation policy and whether one payment can cover multiple bookings.
- Cancellation and refund representation (refund processing is out of scope; historical accounting treatment still needs definition).
- Record retention, archival, and deletion/anonymization behavior.

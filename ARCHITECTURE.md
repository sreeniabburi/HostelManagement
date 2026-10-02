# Architecture

## Status

Selected implementation baseline: React + TypeScript, Cloudflare Workers, and Cloudflare D1. Initial-admin bootstrap, password sign-in, server-side sessions, hostel/room/bed inventory, admin-managed staff access, guest/booking records, bed date-conflict checks, off-app payment records, balances, reports, and CSV report export are implemented. Signed-in users can change their passwords, and admins can reset staff passwords; forgotten administrator-password recovery is not implemented. Booking rent is entered as the agreed total by staff; rent-rule automation is not implemented. API responses have basic security headers, and the D1 health endpoint checks database availability. Manual D1 export/restore steps are documented, but scheduled backups, restore drills, email reminders, and real deployment remain incomplete.

## Logical components

```text
Desktop / Mobile Browser
          |
          v
Application API and Authentication
   |          |             |
   v          v             v
Domain      Relational    Notification
services    database      worker/provider
   |                         |
   +-------------------------+
          |
          v
    Audit events
```

## Independent customer deployment model

Use one maintained codebase that can be deployed repeatedly. Each customer/owner gets an independent application deployment with its own database, secrets, email configuration, and initial administrator. A clone copies source code only; provisioning and deploying it must also create/configure the customer's cloud resources and apply database migrations.

Do not place multiple owners' guest or payment data in a shared database by default. Do not depend on customer identity being selected from a shared tenant directory. Each deployment may still manage multiple hostels belonging to its single owner.

Make instance-specific settings available through documented deployment configuration. On a fresh instance, first signup creates the initial admin and must atomically disable further public signup. Because this creates a public first-user race, the owner must complete setup before sharing the instance URL; the deployment guide must explain this limitation. Schema changes should use repeatable migrations. Keep customer data and secrets out of the Git repository.

## Selected low-cost hosting approach

React + TypeScript provides the responsive application UI. Cloudflare Workers serves the API and can host the static frontend; D1 stores operational records, and a scheduled Worker can run overdue-reminder jobs. A transactional email provider can be integrated over HTTPS.

Cloudflare currently documents free Workers and D1 quotas; its Workers Paid plan has a USD $5/month account minimum. That minimum can consume or exceed an INR 500 monthly budget after exchange rates, taxes, or bank fees. Free-tier capacity and service guarantees are not a substitute for verifying production backup and availability needs. See current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

Supabase was considered but not selected for the initial version. Its built-in PostgreSQL, Auth, and row-level security could reduce implementation work, but its Free projects pause after one week of inactivity. Cloudflare was preferred for the free-tier/no-inactivity-pause target; the application must implement and thoroughly test authentication, sessions, authorization, and data integrity.

### User interface

- Responsive web interface for desktop and mobile.
- Presents role- and hostel-scoped views and workflows.
- Treats the server as the authority for permissions, calculations, and status transitions.

### Application/API

- Authenticates users and enforces admin-only inventory mutations. Staff accounts are created by admins, assigned to selected hostels, and can be deactivated to revoke sessions.
- Supports signed-in password changes and admin resets of active staff passwords; both revoke the target account's existing sessions. Forgotten administrator-password recovery remains an operational blocker.
- Provides validated operations for hostels, configuration, guests, bookings, beds, payments, and reports.
- Applies no-store and basic browser security headers to JSON API responses; exposes a minimal D1-backed health check at `/api/health`.
- Checks bed date overlaps on the server, uses check-in inclusive/check-out exclusive date ranges, and restricts booking, guest, payment, availability, and report data to an assigned hostel.
- Stores booking rent and payment amounts as integer cents and derives outstanding balances from the booking total minus recorded receipts.
- Exposes only the minimum data required for each authorized workflow.

### Domain areas

- **Organization and access:** ownership, hostels, staff accounts, roles, and hostel assignments.
- **Inventory:** floors, rooms, beds, sharing options, and maintenance blocks.
- **Guest and booking:** guest records, reservations, stays, bed assignments, and booking history.
- **Rent and ledger:** rent configuration, charges, payment records, adjustments, and balances.
- **Notifications:** payment confirmations and overdue reminders, with delivery status.
- **Reporting and audit:** filtered operational aggregates and immutable or append-only audit history where appropriate.

### Persistence

Use D1 as the initial data store. Migrations define users, sessions, hostels, floors, rooms, beds, authentication limits, guests, bookings, and payment records. Booking reservation insertion conditionally excludes overlapping active bookings; payment amounts are validated against the remaining booking balance. Guest and payment history are retained for the relevant hostel. Rent totals are manually entered when booking, not derived from configurable sharing rates. Email, audit events, automated rent rules, backup/restore, and production operations are not implemented.

Critical operations should be atomic where possible:

- Create a booking only if the bed remains available for the requested period.
- Save each external payment as an immutable receipt record and derive the current balance from receipts.
- Save an audit event for important changes.
- Queue a payment-confirmation event only after the payment transaction commits.

### Notification delivery

- Separate durable application state from email delivery.
- Queue notification work after the relevant database transaction commits.
- Track recipient, template/type, related record, queued/sent/failed state, attempt count, and timestamps without retaining unnecessary message content.
- Make delivery retries idempotent and expose failures to authorized staff.
- Select an email provider and delivery mechanism during implementation planning.

## Core business invariants

- Every operational record belongs to a hostel directly or through a related record.
- A staff member can access only hostels assigned to that account.
- A bed cannot have overlapping active reservations or stays, subject to the exact booking interval convention.
- A room's sharing option cannot exceed its configured bed capacity.
- Occupancy is derived from bed assignments and booking state, not an independently editable duplicate.
- Outstanding balance is derived from applicable charges and recorded credits/payments, with explicit handling for adjustments and rounding.
- A payment is recorded only after successful persistence; email failure does not undo a successfully recorded payment.
- The application records cash/UPI payments that happened outside the app and never initiates payment transactions.

## External integrations

- Email delivery provider for payment confirmations and overdue reminders.
- No payment gateway integration is in scope.
- Hosting, logging/monitoring, and backup services are not selected.

## Open architecture decisions

- Owner-controlled recovery procedure for a forgotten administrator password.
- Exact D1 schema, migrations, indexes, and booking-conflict strategy.
- Background-job or queue technology for scheduled reminders and email delivery.
- Email provider, sender identity, templates, retry policy, and delivery monitoring.
- Whether the INR 500/month target includes a custom domain, provider taxes, email overages, and paid backups.
- Who creates and owns the cloud resources and email credentials for each customer clone.
- Automated backup schedule/retention, restore-drill cadence, monitoring, and operational ownership. A manual D1 SQL export/restore runbook is documented; SQL exports contain readable personal and financial data.
- Expected scale, availability, and recovery objectives.

## Architecture validation

Architecture tests and integration tests should verify authorization scope, booking conflict prevention under concurrent requests, atomic payment persistence, idempotent notification retries, and report correctness.

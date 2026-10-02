# Architecture Draft

## Status

This is a technology-neutral logical architecture. No language, framework, database, email provider, hosting platform, or deployment topology has been selected. Treat component boundaries and interfaces as design guidance, not final implementation decisions.

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

Make instance-specific settings available through documented deployment configuration. A first-run setup or controlled bootstrap process should create the initial admin securely without committing credentials. Schema changes should use repeatable migrations. Keep customer data and secrets out of the Git repository.

## Candidate low-cost hosting approach

Cloudflare Workers with D1 is a candidate for a small, independently deployed responsive app: Workers can serve application/API code, D1 can hold operational records, and a scheduled Worker can run overdue-reminder jobs. A transactional email provider can be integrated over HTTPS. Validate the framework, authentication design, concurrency constraints, export/backup process, and runtime limits before committing to this stack.

Cloudflare currently documents free Workers and D1 quotas; its Workers Paid plan has a USD $5/month account minimum. That minimum can consume or exceed an INR 500 monthly budget after exchange rates, taxes, or bank fees. Free-tier capacity and service guarantees are not a substitute for verifying production backup and availability needs. See current [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/).

### User interface

- Responsive web interface for desktop and mobile.
- Presents role- and hostel-scoped views and workflows.
- Treats the server as the authority for permissions, calculations, and status transitions.

### Application/API

- Authenticates users and enforces role and hostel access on every operation.
- Provides validated operations for hostels, configuration, guests, bookings, beds, charges, payments, reports, and notifications.
- Implements business rules for booking conflicts, occupancy, rent calculations, balances, and checkout.
- Exposes only the minimum data required for each authorized workflow.

### Domain areas

- **Organization and access:** ownership, hostels, staff accounts, roles, and hostel assignments.
- **Inventory:** floors, rooms, beds, sharing options, and maintenance blocks.
- **Guest and booking:** guest records, reservations, stays, bed assignments, and booking history.
- **Rent and ledger:** rent configuration, charges, payment records, adjustments, and balances.
- **Notifications:** payment confirmations and overdue reminders, with delivery status.
- **Reporting and audit:** filtered operational aggregates and immutable or append-only audit history where appropriate.

### Persistence

Use a persistent data store that can enforce transactional consistency for critical operations. A relational database is a suitable candidate because bookings, bed assignments, charges, and payments have structured relationships and consistency constraints; the final choice remains open.

Critical operations should be atomic where possible:

- Create or update a booking only if the bed remains available for the requested period.
- Save a payment record and balance-affecting ledger entries consistently.
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

- Application language, framework, and frontend approach.
- Authentication provider and account provisioning/recovery.
- Database and migration strategy.
- Background-job or queue technology for scheduled reminders and email delivery.
- Email provider, sender identity, templates, retry policy, and delivery monitoring.
- Hosting platform, regions, environments, and network topology.
- Whether the INR 500/month target includes a custom domain, provider taxes, email overages, and paid backups.
- Who creates and owns the cloud resources and email credentials for each customer clone.
- Backup/restore strategy, monitoring, and operational ownership.
- Expected scale, availability, and recovery objectives.

## Architecture validation

Architecture tests and integration tests should verify authorization scope, booking conflict prevention under concurrent requests, atomic payment persistence, idempotent notification retries, and report correctness.

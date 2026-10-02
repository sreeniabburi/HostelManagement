# Hostel Management System

A responsive application concept for managing multiple hostels, guests, reservations, room and bed occupancy, rent balances, off-app payment records, email notifications, and reports.

The system records payments received by staff through cash or UPI; it does not process payments.

## Project documents

- [Project brief](./PROJECT.md) — goals, roles, requirements, scope, and acceptance criteria.
- [Design specification](./DESIGN.md) — navigation, screens, workflows, and responsive behavior.
- [Architecture draft](./ARCHITECTURE.md) — technology-neutral system structure and open decisions.
- [Data model draft](./DATA_MODEL.md) — conceptual entities and relationships.
- [Security and privacy](./SECURITY_AND_PRIVACY.md) — data handling and security requirements.
- [Deployment guide](./DEPLOYMENT.md) — environment-neutral deployment checklist and open decisions.

## Deployment and customer isolation

Prefer free tiers and aim for zero recurring cost where practical. If the customer supplies a domain, target at most INR 500/month for hosting and database; track domain registration separately. Email, taxes, backups, and other charges can vary and must be itemized for each deployment. The same codebase should be deployable separately for different owners, with each deployment using its own database, credentials, email configuration, and initial admin. Cloning the Git repository does not provision cloud resources; each instance needs a documented setup/deploy process. See [ARCHITECTURE.md](./ARCHITECTURE.md) and [DEPLOYMENT.md](./DEPLOYMENT.md).

Cloudflare Workers with D1 is documented as a candidate, not a finalized stack. Free-tier limits, backup needs, domain costs, taxes, and email usage must be evaluated before promising a production cost.

## Current status

This repository contains planning and design documents. An application stack and deployment environment have not yet been selected.

## Requirements highlights

- Manage multiple hostels, with staff access assigned by administrators.
- Configure floors, rooms, beds, sharing options, rent rules, due dates, and reminder schedules per hostel.
- Support future reservations, check-ins, bed assignments, and actual checkout dates.
- Collect guest contact details and identity-proof type; do not upload identity documents.
- Record payments staff have received outside the app, by cash or UPI, including partial payments.
- Update balances and email guests when a payment is recorded; send configured overdue reminders.
- Provide occupancy, booking, collection, balance, and overdue reports.

See [PROJECT.md](./PROJECT.md) for the complete requirements and [DESIGN.md](./DESIGN.md) for the screen-level design.

## Development

No application code or run commands have been added yet. Development setup instructions will be added after the technology stack is selected.

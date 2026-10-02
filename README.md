# Hostel Management System

A responsive application concept for managing multiple hostels, guests, reservations, room and bed occupancy, rent balances, off-app payment records, email notifications, and reports.

The system records payments received by staff through cash or UPI; it does not process payments.

## Project documents

- [Project brief](./PROJECT.md) — goals, roles, requirements, scope, and acceptance criteria.
- [Design specification](./DESIGN.md) — navigation, screens, workflows, and responsive behavior.
- [Architecture](./ARCHITECTURE.md) — selected initial stack, system structure, and open decisions.
- [Data model draft](./DATA_MODEL.md) — conceptual entities and relationships.
- [Security and privacy](./SECURITY_AND_PRIVACY.md) — data handling and security requirements.
- [Deployment guide](./DEPLOYMENT.md) — environment-neutral deployment checklist and open decisions.

## Deployment and customer isolation

Prefer free tiers and aim for zero recurring cost where practical. If the customer supplies a domain, target at most INR 500/month for hosting and database; track domain registration separately. Email, taxes, backups, and other charges can vary and must be itemized for each deployment. The same codebase should be deployable separately for different owners, with each deployment using its own database, credentials, email configuration, and initial admin. Cloning the Git repository does not provision cloud resources; each instance needs a documented setup/deploy process. See [ARCHITECTURE.md](./ARCHITECTURE.md) and [DEPLOYMENT.md](./DEPLOYMENT.md).

Selected initial stack: React + TypeScript, Cloudflare Workers, and D1. The email provider and production backup/restore approach remain open. Free-tier limits, backup needs, domain costs, taxes, and email usage must be evaluated per deployment; free-tier availability is not a production cost or backup guarantee.

## Current status

The app has first-administrator setup, server-side sign-in, secure cookie sessions, D1-backed hostel/floor/room/bed inventory, and admin-managed staff accounts with hostel assignments. Bookings and guest profiles are saved to D1; date-overlap checks reserve beds, and staff can check guests in, check them out, or cancel reservations. Staff can enter the agreed total rent for each booking and record partial or full cash, UPI, bank-transfer, or other payments received outside the app. Guest directory, booking history, outstanding balances, occupancy and receipt summaries, and CSV report export are database-backed. Signed-in users can change their passwords and admins can reset staff passwords; forgotten owner/admin-password recovery remains a production blocker. Manual D1 SQL export and restore commands are documented, but automated backups and restore drills are not configured. Email reminders are still deferred.

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

### Local application preview

```powershell
cd app
npm install
npm run db:migrate:local
npm run dev
```

Production build check:

```powershell
cd app
npm run build
```

For a Cloudflare account, authenticate with `npx wrangler login`, create a D1 database with `npx wrangler d1 create hostel-management`, replace the placeholder `database_id` in `app/wrangler.jsonc` with the ID returned by Wrangler, apply the schema using `npm run db:migrate:remote`, then deploy with `npm run deploy`. Deployment is blocked until a real database ID is configured. Keep the deployed URL private until the owner creates the first administrator.

The local Wrangler D1 configuration stores development data under the ignored `app/.wrangler/` directory. Do not use it for real guest information. Production deployment is not yet complete. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the health check, manual backup/restore runbook, and unresolved owner-account recovery requirement.

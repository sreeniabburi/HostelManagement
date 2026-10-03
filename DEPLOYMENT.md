# Deployment Guide

## Status

Selected initial target: React + TypeScript hosted with Cloudflare Workers/static assets, with Cloudflare D1 for data. The current app, including its admin-only CSV importer, is deployed at [hosteldesk-app-2026.workers.dev](https://hostel-management.hosteldesk-app-2026.workers.dev/) and has a database-backed health check and Wrangler D1 SQL export/restore commands. The current Wrangler configuration points to that deployment's D1 database, and migration `0006_payment_import_keys.sql` is applied. Forgotten admin-password recovery, scheduled/retained backups, and alert routing remain unresolved, so the service is not yet production-ready.

## Cost and customer isolation targets

- Prefer free tiers and aim for zero recurring cost where practical. When a customer supplies a domain, target no more than INR 500/month for hosting and database; domain registration is separate.
- Itemize email, taxes, backups, and any other recurring or usage-based charges per deployment. They may be free in some configurations and may incur costs in others; verify current pricing and agree the applicable budget before deployment.
- Each customer deployment must have a separate database, application configuration, secrets, email-provider credentials, and initial administrator. Deploying a cloned repository alone does not provision these resources.
- The source repository may be cloned, but customer data and credentials must be supplied through protected cloud configuration and must never be copied from another deployment.
- Confirm which cost categories apply before declaring a deployment within budget; do not assume a free email quota, backup, or tax treatment.
- Show or document provider quotas and establish usage/billing alerts where supported. Free-tier limits and terms may change; recheck them before launch.

Cloudflare Workers plus D1 is the selected initial target. Cloudflare currently lists a free Workers plan and D1 free quotas, while the Workers Paid plan starts at USD $5/month per account. The paid minimum may exceed the INR 500 target after currency conversion and taxes. Email plans and custom-domain costs are separate. Check current pricing and operational limits rather than treating a free tier as a cost or availability guarantee:

- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Resend email pricing](https://resend.com/pricing) (example provider; not selected)

## Environments

Plan separate environments for:

- **Local development:** safe sample data and non-production email behavior.
- **Test/staging:** production-like configuration for workflow and release verification.
- **Production:** restricted access, monitored services, backups, and real email delivery.

Do not use production guest information in local or test environments. Keep environment-specific configuration and secrets outside the source repository.

The current implementation stores user accounts, password hashes, sessions, hostel inventory, guest profiles, bookings, and payment receipts in D1. Passwords use PBKDF2-SHA-256 hashes; browser sessions use HttpOnly, SameSite=Strict cookies and database-backed expiry. Users can change their own password while signed in, and admins can reset staff passwords; either action revokes other sessions. Forgot-admin-password recovery, scheduled/retained backups, and alert routing remain unresolved, so this is not yet production-ready.

## Configuration and secrets

The app config binds D1 as `DB` and currently contains the D1 ID for the existing deployment. For a new, isolated customer deployment:

1. Authenticate Wrangler with `npx wrangler login` and verify with `npx wrangler whoami`.
2. Create a production D1 database with `npx wrangler d1 create hostel-management`.
3. Replace `database_id` in `app/wrangler.jsonc` with that instance's returned ID.
4. Review the target account/name and take a pre-migration backup.
5. Apply migrations with `npm run db:migrate:remote`, then deploy with `npm run deploy`.
6. Check `https://<worker-host>/api/health` returns HTTP 200 and `{"status":"ok","database":"ok"}`.
7. Keep the deployment URL private until the owner creates the first administrator. Verify a second unauthenticated bootstrap attempt is rejected.

Use `npm run db:migrate:local` before starting local development. Never copy local/test data into production.

The implementation will require configuration for the selected platform, including:

- Application environment and public URL.
- Database connection and migration settings.
- Authentication/session configuration.
- Email provider credentials, sender identity, and callback/webhook configuration if applicable.
- Logging and monitoring endpoints.
- Backup and retention settings.

Use the platform's protected secret/configuration facility. Do not commit credentials or put secrets in client-side bundles. Document required variable names and safe example values once the stack is chosen.

## Release process

1. Review and test code changes, including authorization and data-integrity tests.
2. Build a versioned release artifact through the selected build process.
3. Provision isolated cloud resources and protected configuration for the intended customer.
4. Apply reviewed database migrations with a recovery plan.
5. Keep the new instance private while the owner creates the first account; first signup becomes Admin and must atomically disable further public signup.
6. Deploy to staging and verify login, hostel access boundaries, bookings, payment recording, email delivery, and reports.
7. Promote the same verified artifact to that customer's production deployment.
8. Monitor errors, notification delivery, provider quotas, and operational health.
9. Document rollback steps, accounting for any irreversible schema changes or data writes.

Do not treat a failed email send as a reason to roll back a saved payment; expose the notification failure for follow-up.

## Production safeguards

- Serve the application over encrypted transport.
- Restrict database, administration, and deployment access to authorized operators.
- Enable automated backups and verify restoration periodically.
- Define backup retention and protect backups as sensitive data.
- Monitor application errors, database health, scheduled reminder jobs, and email delivery failures.
- Use health checks and alerting appropriate to the selected platform.
- Ensure scheduled reminder processing is timezone-aware and safe against duplicate sends.
- Use least-privilege service accounts and rotate credentials.
- Provide a documented way to disable outgoing email during maintenance or incident response.
- Protect health-check/observability endpoints from exposing data; the current check reports only application and D1 availability.

## D1 backup and restore runbook

D1 SQL exports contain personal and financial records in readable form. Store them outside the repository on encrypted, access-restricted storage. Do not email, commit, or leave exports in a shared downloads folder. Set the backup directory and retention policy with the owner before production.

Create a one-time export to a private location (PowerShell, from `app`):

```powershell
$backupDir = Join-Path $env:USERPROFILE 'HostelManagementBackups'
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$backup = Join-Path $backupDir ("hostel-management-{0}.sql" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
npm run db:backup -- --remote --output $backup
```

Verify the command succeeds, record its date and target database, and verify file integrity and access restrictions. The SQL file is not encrypted by Wrangler; use an encrypted volume or encrypt it before off-device storage. This command is a manual export, not a scheduled backup or a guarantee of point-in-time recovery. Choose and verify the service-level backup/Time Travel option and retention before launch.

For a restore drill, create a separate, empty D1 database in the same Cloudflare account and restore the export to that database, not over production:

```powershell
npx wrangler d1 create hostel-management-restore
npx wrangler d1 execute hostel-management-restore --remote --file $backup
```

Use the new database's ID only in a private staging configuration. Verify migration/schema state, admin sign-in, assigned-hostel access, bookings, payment totals, and reports against the restored data. Do not point production at the restored database until the owner approves the restore and the application version/schema compatibility has been checked. Retire the drill database and securely remove temporary exports when no longer needed. A restore replaces the deployment's data source; do not import an export into a populated production database.

## Account recovery boundaries

- A signed-in user can change their own password from **Account security** after confirming the current password. Other active sessions are revoked.
- An administrator can set a new password for an active staff account. The admin must share the new password through a separate secure channel; the staff member's sessions are revoked.
- Forgotten administrator-password recovery is **not implemented**. Do not expose a public reset endpoint or use a shared/default password. Production launch is blocked until an owner-controlled, tested recovery procedure exists. Keep Cloudflare account recovery and D1 access limited to designated operators; a database-level recovery must be performed as a documented incident, with a pre-change backup, session revocation, and audit/owner notification.

## Operational runbooks to prepare

- Routine deployment and rollback.
- Database migration failure and recovery.
- Backup restoration.
- Lost or compromised staff account.
- Email provider outage and notification retry.
- Suspected data exposure or unauthorized access.
- Staff offboarding and hostel access revocation.

## Decisions needed before deployment

- Hosting provider, region, and data residency needs.
- Cloudflare account setup and per-customer provisioning workflow.
- Email provider, sender verification, bounce handling, and retry policy.
- Backup/export and restore mechanism for D1.
- Domain name, TLS/certificate management, and network boundaries.
- Authentication and account recovery approach.
- Backup frequency, retention, restoration objectives, and responsible owner.
- Monitoring/alerting provider and on-call or support responsibilities.
- Expected usage, availability target, and recovery objectives.
- Applicable privacy, retention, and incident-notification requirements.

## Go-live checklist

- Production account and hostel configuration reviewed.
- Initial owner account created before the deployment URL is shared; public signup is disabled afterward.
- Admin and staff access tested with least privilege.
- No sample or test guest records in production.
- Database migrations and backup/restore procedures verified.
- Owner-account recovery tested by an authorized operator.
- Payment recording and balance calculations validated.
- Payment confirmation and overdue reminder delivery tested safely.
- Email failure and duplicate-retry behavior tested.
- Monitoring, escalation, and incident contacts documented.
- User guidance and operational procedures available to staff.

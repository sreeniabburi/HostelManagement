# Deployment Guide

## Status

Deployment platform, runtime, database, email provider, and application stack have not been selected. This guide records environment-neutral requirements and the checklist to complete after those decisions.

## Environments

Plan separate environments for:

- **Local development:** safe sample data and non-production email behavior.
- **Test/staging:** production-like configuration for workflow and release verification.
- **Production:** restricted access, monitored services, backups, and real email delivery.

Do not use production guest information in local or test environments. Keep environment-specific configuration and secrets outside the source repository.

## Configuration and secrets

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
3. Apply reviewed database migrations with a recovery plan.
4. Deploy to staging and verify login, hostel access boundaries, bookings, payment recording, email delivery, and reports.
5. Promote the same verified artifact to production.
6. Monitor errors, notification delivery, and operational health.
7. Document rollback steps, accounting for any irreversible schema changes or data writes.

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
- Application and database technology.
- Domain name, TLS/certificate management, and network boundaries.
- Authentication and account recovery approach.
- Email provider, sender verification, bounce handling, and retry policy.
- Backup frequency, retention, restoration objectives, and responsible owner.
- Monitoring/alerting provider and on-call or support responsibilities.
- Expected usage, availability target, and recovery objectives.
- Applicable privacy, retention, and incident-notification requirements.

## Go-live checklist

- Production account and hostel configuration reviewed.
- Admin and staff access tested with least privilege.
- No sample or test guest records in production.
- Database migrations and backup/restore procedures verified.
- Payment recording and balance calculations validated.
- Payment confirmation and overdue reminder delivery tested safely.
- Email failure and duplicate-retry behavior tested.
- Monitoring, escalation, and incident contacts documented.
- User guidance and operational procedures available to staff.

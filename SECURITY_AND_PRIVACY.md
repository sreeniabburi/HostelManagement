# Security and Privacy Requirements

## Purpose and status

This document records security and privacy requirements for the Hostel Management System. It is a product and implementation baseline, not legal advice or a claim of regulatory compliance. Applicable legal requirements and operational policies must be confirmed before launch.

## Implemented foundation status

The current implementation includes a one-time first-administrator bootstrap, server-verified sign-in, PBKDF2-SHA-256 password hashes, database-backed sessions delivered in HttpOnly/SameSite=Strict cookies, and a basic per-email/IP-hash sign-in throttle. Admins can create staff accounts with a chosen password, assign hostels, deactivate accounts, and reset staff passwords. A signed-in user can change their own password. Password changes revoke existing sessions. Staff reads and guest, booking, payment, availability, and report operations are limited to assigned hostels; inventory changes remain admin-only. Guest profiles, booking history, external payment receipts, and reports are persisted in D1. Forgotten administrator-password recovery, scheduled backups, a restore drill, audit history, email notifications, and production security validation are not implemented. Do not use this implementation for real guest records until deployment, backup, owner recovery, access, and privacy controls have been reviewed for production.

## Data handled

The application is expected to store:

- Guest name, email address, mobile number, address, and emergency contact number.
- Identity-proof **type** (Aadhaar card, driving licence, voter ID, or PAN card).
- Hostel, room, bed, reservation, check-in, checkout, and booking-history details.
- Rent charges, payment records entered by staff, outstanding balances, and payment references or notes.
- User account, role, hostel access, audit, and email-notification records.

The application must not upload identity documents, store payment credentials, or initiate payment transactions. The current requirements do not request storage of full identity-document numbers; do not add such fields without an explicit product and privacy review.

## Access control

- Require authenticated accounts for application access.
- Enforce least-privilege, role-based access in backend operations as well as in the interface.
- Scope staff access to hostels assigned by an administrator.
- Restrict administration of users, hostel configuration, rent rules, and reminder schedules to authorized users.
- Check hostel authorization on every read and write involving hostel-owned records; do not rely only on a selected-hostel UI control.
- Revoke or update access promptly when a staff member's responsibilities change.
- Protect account recovery and administrative actions against unauthorized use.

## Data protection

- Use encrypted transport for application and email-provider connections.
- Use encryption at rest for databases, backups, and stored exports where supported by the selected platform.
- Store secrets in an appropriate secrets manager or protected deployment configuration; never commit credentials to the repository.
- Do not log passwords, authentication tokens, full guest contact details, or unnecessary payment notes.
- Do not store card, bank, or UPI credentials. Payment method is a staff-entered record of an external payment.
- Avoid collecting information beyond the stated guest and operational requirements.
- Limit access to exported reports and protect temporary exports from unintended exposure.

## Payments and auditability

- Treat a payment as recorded only after the database transaction has succeeded.
- Preserve who recorded a payment, when it was recorded, amount, method, and any reference or note.
- Corrections should be auditable. Prefer reversal/adjustment records over silently overwriting or deleting financial history.
- Calculate outstanding balances from authoritative rent charges and recorded payments, with a documented approach to adjustments and rounding.
- Keep an audit trail for significant changes to bookings, assignments, rent configuration, payments, access permissions, and notification state.
- Avoid putting sensitive guest or payment details in audit event payloads unless necessary.

## Email notifications

- Send payment confirmations only after a payment has been saved successfully.
- Record send status and time; surface failures to authorized staff.
- Send overdue reminders only when an outstanding balance exists and the configured schedule calls for a reminder.
- Use a reliable delivery mechanism that can safely retry transient failures without creating duplicate payment records or duplicate reminders.
- Do not expose one guest's information to another guest in email headers or message content.
- Keep email templates free of unnecessary personal data.

## Application security

- Validate inputs server-side, including amounts, dates, status transitions, hostel scope, and bed availability.
- Protect against common web risks such as injection, cross-site scripting, cross-site request forgery where applicable, insecure direct object references, and broken access control.
- Use secure session handling, account recovery, and password storage according to the selected framework's established practices.
- Apply rate limits or abuse protections to authentication and externally exposed endpoints.
- Keep dependencies patched and review security-relevant changes before release.
- Return actionable but non-sensitive error messages; do not disclose internal details to end users.

## Retention, deletion, and incident handling

The following operational decisions remain open and must be resolved before production:

- Guest, booking, payment, audit, and email-log retention periods.
- Process for correcting guest information and handling deletion or access requests.
- Backup frequency, retention, restore testing, and access ownership.
- Incident response contacts, escalation process, and notification obligations.
- Email provider and hosting regions, and any data residency requirements.

Do not silently delete financial or audit records to satisfy a guest-record deletion workflow. Establish a reviewed retention and de-identification policy that handles linked records consistently.

## Pre-launch checklist

- Confirm applicable privacy, accommodation, identity-record, and financial-record requirements with qualified stakeholders.
- Confirm whether any identity number is actually required; default to not collecting it.
- Verify role and hostel isolation with automated tests.
- Verify that logs, backups, exports, and email content do not disclose unnecessary personal data.
- Test payment-save and email-failure behavior, including safe retries.
- Document retention, backup, restore, and incident response procedures.
- Review production configuration for secrets, transport security, access controls, and dependency updates.

import { db, customerContactsTable, escalationNotificationsTable, ticketUpdatesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { severityMeetsThreshold, type SeverityLevel } from "./severity";

interface NotificationTicket {
  id: string;
  ticketNumber: string;
  customerId: string;
  title: string;
  severity: string;
  status: string;
  openedAt: Date;
}

export interface NotificationResult {
  notified: number;
  contacts: Array<{ name: string; email: string; role: string; reason: string }>;
}

function buildMessage(contact: { name: string; role: string }, ticket: NotificationTicket, durationMinutes: number, reason: string): string {
  const durationText = durationMinutes < 60
    ? `${durationMinutes} minute${durationMinutes !== 1 ? "s" : ""}`
    : `${Math.round(durationMinutes / 60)} hour${Math.round(durationMinutes / 60) !== 1 ? "s" : ""}`;

  const reasonText = reason === "duration_threshold"
    ? `This ticket has been open for ${durationText} and has reached your escalation threshold.`
    : `This ticket meets your severity notification threshold (${ticket.severity}).`;

  return `[SIMULATED EMAIL — NOT SENT]

To: ${contact.name} (${contact.role.toUpperCase()})
Subject: [${ticket.severity.toUpperCase()}] Service Assurance Alert: ${ticket.ticketNumber} — ${ticket.title}

Dear ${contact.name},

You are receiving this notification because a service ticket requires your attention.

Ticket: ${ticket.ticketNumber}
Title: ${ticket.title}
Severity: ${ticket.severity.toUpperCase()}
Status: ${ticket.status.replace(/_/g, " ")}
Duration: ${durationText}

${reasonText}

Please log into the Service Assurance portal to review and take action.

This is a simulated notification. Real email delivery can be enabled by connecting an SMTP provider.`;
}

export async function evaluateEscalation(ticket: NotificationTicket, triggeredBy?: string): Promise<NotificationResult> {
  const now = new Date();
  const durationMinutes = Math.floor((now.getTime() - new Date(ticket.openedAt).getTime()) / 60000);

  const contacts = await db
    .select()
    .from(customerContactsTable)
    .where(eq(customerContactsTable.customerId, ticket.customerId));

  if (!contacts.length) return { notified: 0, contacts: [] };

  const existing = await db
    .select({ contactId: escalationNotificationsTable.contactId, reason: escalationNotificationsTable.reason })
    .from(escalationNotificationsTable)
    .where(eq(escalationNotificationsTable.ticketId, ticket.id));

  const alreadyNotifiedBySeverity = new Set(
    existing.filter(e => e.reason === "severity_threshold").map(e => e.contactId)
  );

  const notifiedContacts: Array<{ name: string; email: string; role: string; reason: string }> = [];
  const notifications: typeof escalationNotificationsTable.$inferInsert[] = [];

  for (const contact of contacts) {
    const meetsSevertiy = severityMeetsThreshold(ticket.severity as SeverityLevel, contact.notifyOnSeverity as SeverityLevel);
    const meetsDuration = contact.notifyOnDurationMinutes != null && durationMinutes >= contact.notifyOnDurationMinutes;

    if (meetsSevertiy && !alreadyNotifiedBySeverity.has(contact.id)) {
      const reason = "severity_threshold" as const;
      notifications.push({
        ticketId: ticket.id,
        contactId: contact.id,
        contactName: contact.name,
        contactEmail: contact.email,
        contactRole: contact.role,
        severity: ticket.severity,
        channel: "email",
        reason,
        durationMinutes,
        message: buildMessage(contact, ticket, durationMinutes, reason),
        status: "simulated",
      });
      notifiedContacts.push({ name: contact.name, email: contact.email, role: contact.role, reason });
    } else if (meetsDuration) {
      const alreadyEscalated = existing.some(
        e => e.contactId === contact.id && e.reason === "duration_threshold"
      );
      if (!alreadyEscalated) {
        const reason = "duration_threshold" as const;
        notifications.push({
          ticketId: ticket.id,
          contactId: contact.id,
          contactName: contact.name,
          contactEmail: contact.email,
          contactRole: contact.role,
          severity: ticket.severity,
          channel: "email",
          reason,
          durationMinutes,
          message: buildMessage(contact, ticket, durationMinutes, reason),
          status: "simulated",
        });
        notifiedContacts.push({ name: contact.name, email: contact.email, role: contact.role, reason });
      }
    }
  }

  if (notifications.length > 0) {
    await db.insert(escalationNotificationsTable).values(notifications);

    const namesText = notifiedContacts.map(c => `${c.name} (${c.role})`).join(", ");
    const logText = triggeredBy
      ? `Escalation evaluated by ${triggeredBy}. Notified ${notifiedContacts.length} contact(s): ${namesText}`
      : `Automatic escalation: Notified ${notifiedContacts.length} contact(s): ${namesText}`;

    await db.insert(ticketUpdatesTable).values({
      ticketId: ticket.id,
      updateType: "system_event",
      rawText: logText,
      visibility: "internal",
    });
  }

  return { notified: notifiedContacts.length, contacts: notifiedContacts };
}

const G = "repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)";

export default function Slide11EscalationEngine() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", fontFamily: "'Inter', sans-serif", backgroundImage: G }}>
      <div style={{ position: "absolute", top: "5vh", left: "5vw", width: "3vw", height: "3vw", backgroundColor: "#3D5A80" }} />
      <div style={{ position: "absolute", top: "5vh", right: "5vw", textAlign: "right" }}>
        <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5vh" }}>Service Assurance AI</div>
        <div style={{ color: "#999999", fontSize: "0.9vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Engineering Handoff / May 2026</div>
      </div>
      <div style={{ position: "absolute", top: "18vh", left: "10vw", width: "80vw" }}>
        <h2 style={{ color: "#111111", fontSize: "4vw", margin: "0 0 1vh 0", fontWeight: 700, letterSpacing: "-0.02em" }}>Escalation Notification Engine</h2>
        <p style={{ color: "#666666", fontSize: "1.4vw", margin: "0 0 3.5vh 0" }}>Fires automatically on ticket creation and on manual re-evaluation — deduplicates by contact+reason per ticket.</p>
        <div style={{ display: "flex", gap: "2.5vw" }}>
          <div style={{ flex: 1, border: "1px solid #E0E0E0", padding: "2.5vw" }}>
            <div style={{ width: "2.5vw", height: "3px", backgroundColor: "#3D5A80", marginBottom: "1.5vh" }} />
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 700, marginBottom: "1.2vh" }}>Customer Contacts</div>
            <div style={{ color: "#666666", fontSize: "1.3vw", lineHeight: 1.7 }}>
              Per-customer escalation contacts with role (noc / manager / director / executive), notifyOnSeverity threshold, and optional notifyOnDurationMinutes.
            </div>
            <div style={{ marginTop: "1.5vh", padding: "1vh 1.2vw", backgroundColor: "#F8F9FA", fontFamily: "monospace", fontSize: "1.1vw", color: "#3D5A80" }}>
              table: customer_contacts
            </div>
          </div>
          <div style={{ flex: 1, border: "1px solid #E0E0E0", padding: "2.5vw" }}>
            <div style={{ width: "2.5vw", height: "3px", backgroundColor: "#98C1D9", marginBottom: "1.5vh" }} />
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 700, marginBottom: "1.2vh" }}>Notification Engine</div>
            <div style={{ color: "#666666", fontSize: "1.3vw", lineHeight: 1.7 }}>
              Evaluates contacts on ticket POST (fire-and-forget). Resolves the matrix scope for severity, checks thresholds, deduplicates, logs simulated email, writes system_event to timeline.
            </div>
            <div style={{ marginTop: "1.5vh", padding: "1vh 1.2vw", backgroundColor: "#F8F9FA", fontFamily: "monospace", fontSize: "1.1vw", color: "#3D5A80" }}>
              lib/notificationEngine.ts
            </div>
          </div>
          <div style={{ flex: 1, border: "1px solid #E0E0E0", padding: "2.5vw" }}>
            <div style={{ width: "2.5vw", height: "3px", backgroundColor: "#EE6C4D", marginBottom: "1.5vh" }} />
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 700, marginBottom: "1.2vh" }}>Notification Log</div>
            <div style={{ color: "#666666", fontSize: "1.3vw", lineHeight: 1.7 }}>
              Simulated emails stored in escalation_notifications. Ticket detail shows panel with who was notified, when, why, with expandable email preview and manual Evaluate button.
            </div>
            <div style={{ marginTop: "1.5vh", padding: "1vh 1.2vw", backgroundColor: "#F8F9FA", fontFamily: "monospace", fontSize: "1.1vw", color: "#3D5A80" }}>
              table: escalation_notifications
            </div>
          </div>
        </div>
        <div style={{ marginTop: "2.5vh", padding: "1.5vh 2vw", backgroundColor: "#F8F9FA", border: "1px solid #E0E0E0", fontSize: "1.3vw", color: "#666666" }}>
          <span style={{ color: "#3D5A80", fontWeight: 600 }}>Hooks:</span> lib/api-client-react/src/escalation-hooks.ts — useGetCustomerContacts, useCreateCustomerContact, useGetTicketNotifications, useEvaluateEscalation
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", color: "#999999", fontSize: "0.9vw", fontWeight: 600 }}>11</div>
    </div>
  );
}

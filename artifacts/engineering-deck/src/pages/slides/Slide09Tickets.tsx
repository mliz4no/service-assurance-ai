const G = "repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)";
const base = import.meta.env.BASE_URL;

export default function Slide09Tickets() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", fontFamily: "'Inter', sans-serif", backgroundImage: G }}>
      <div style={{ position: "absolute", top: "5vh", left: "5vw", width: "3vw", height: "3vw", backgroundColor: "#3D5A80" }} />
      <div style={{ position: "absolute", top: "5vh", right: "5vw", textAlign: "right" }}>
        <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5vh" }}>Service Assurance AI</div>
        <div style={{ color: "#999999", fontSize: "0.9vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Engineering Handoff / May 2026</div>
      </div>
      <div style={{ position: "absolute", top: "18vh", left: "5vw", right: "5vw", bottom: "10vh", display: "flex", gap: "4vw" }}>
        <div style={{ flex: "0 0 22vw", paddingTop: "0" }}>
          <h2 style={{ color: "#111111", fontSize: "3vw", margin: "0 0 3vh 0", fontWeight: 700, letterSpacing: "-0.02em" }}>Ticket Management</h2>
          <div style={{ marginBottom: "2.5vh" }}>
            <div style={{ color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1vh" }}>Status Flow</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5vh" }}>
              <div style={{ backgroundColor: "#F0F4F8", padding: "0.6vh 1vw", fontSize: "1.2vw", color: "#111111", fontFamily: "monospace" }}>open</div>
              <div style={{ color: "#999999", fontSize: "1vw", paddingLeft: "1vw" }}>↓</div>
              <div style={{ backgroundColor: "#F0F4F8", padding: "0.6vh 1vw", fontSize: "1.2vw", color: "#111111", fontFamily: "monospace" }}>in_progress</div>
              <div style={{ color: "#999999", fontSize: "1vw", paddingLeft: "1vw" }}>↓</div>
              <div style={{ backgroundColor: "#F0F4F8", padding: "0.6vh 1vw", fontSize: "1.2vw", color: "#111111", fontFamily: "monospace" }}>pending_vendor</div>
              <div style={{ color: "#999999", fontSize: "1vw", paddingLeft: "1vw" }}>↓</div>
              <div style={{ backgroundColor: "#F0F4F8", padding: "0.6vh 1vw", fontSize: "1.2vw", color: "#111111", fontFamily: "monospace" }}>resolved / closed</div>
            </div>
          </div>
          <div>
            <div style={{ color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1vh" }}>Key Fields</div>
            <div style={{ color: "#666666", fontSize: "1.2vw", lineHeight: 1.8 }}>
              severity · impactLevel · urgencyLevel
            </div>
            <div style={{ color: "#666666", fontSize: "1.2vw", lineHeight: 1.8 }}>
              vendorTicketId · vendorStatus
            </div>
            <div style={{ color: "#666666", fontSize: "1.2vw", lineHeight: 1.8 }}>
              slaBreachedAt · nextEscalationAt
            </div>
            <div style={{ color: "#666666", fontSize: "1.2vw", lineHeight: 1.8 }}>
              isControllerSourced · failoverActive
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <img src={`${base}screen-tickets.jpg`} crossOrigin="anonymous" alt="Tickets screenshot" style={{ width: "100%", height: "72vh", objectFit: "cover", objectPosition: "top", border: "1px solid #E0E0E0" }} />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", color: "#999999", fontSize: "0.9vw", fontWeight: 600 }}>09</div>
    </div>
  );
}

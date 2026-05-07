const G = "repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)";

export default function Slide02Overview() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", fontFamily: "'Inter', sans-serif", backgroundImage: G }}>
      <div style={{ position: "absolute", top: "5vh", left: "5vw", width: "3vw", height: "3vw", backgroundColor: "#3D5A80" }} />
      <div style={{ position: "absolute", top: "5vh", right: "5vw", textAlign: "right" }}>
        <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5vh" }}>Service Assurance AI</div>
        <div style={{ color: "#999999", fontSize: "0.9vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Engineering Handoff / May 2026</div>
      </div>
      <div style={{ position: "absolute", top: "18vh", left: "10vw", width: "80vw" }}>
        <h2 style={{ color: "#111111", fontSize: "4vw", margin: "0 0 1vh 0", fontWeight: 700, letterSpacing: "-0.02em" }}>Product Overview</h2>
        <p style={{ color: "#666666", fontSize: "1.4vw", margin: "0 0 4vh 0" }}>Enterprise telecom service assurance for MSPs, aggregators, and technology advisors.</p>
        <div style={{ display: "flex", gap: "3vw" }}>
          <div style={{ flex: 1, borderTop: "3px solid #3D5A80", paddingTop: "3vh" }}>
            <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2.5vh" }}>Platform Scope</div>
            <div style={{ color: "#111111", fontSize: "4vw", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "0.3vh" }}>14</div>
            <div style={{ color: "#666666", fontSize: "1.3vw", marginBottom: "2vh" }}>managed sites</div>
            <div style={{ color: "#111111", fontSize: "4vw", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "0.3vh" }}>5</div>
            <div style={{ color: "#666666", fontSize: "1.3vw", marginBottom: "2vh" }}>enterprise customers</div>
            <div style={{ color: "#111111", fontSize: "4vw", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "0.3vh" }}>17</div>
            <div style={{ color: "#666666", fontSize: "1.3vw" }}>database tables</div>
          </div>
          <div style={{ flex: 1, borderTop: "3px solid #98C1D9", paddingTop: "3vh" }}>
            <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2.5vh" }}>Core Modules</div>
            <div style={{ color: "#111111", fontSize: "1.55vw", fontWeight: 600, marginBottom: "1.8vh" }}>Multi-vendor ticket management</div>
            <div style={{ color: "#111111", fontSize: "1.55vw", fontWeight: 600, marginBottom: "1.8vh" }}>ITIL severity matrix + escalation</div>
            <div style={{ color: "#111111", fontSize: "1.55vw", fontWeight: 600, marginBottom: "1.8vh" }}>Network map + controller integrations</div>
            <div style={{ color: "#111111", fontSize: "1.55vw", fontWeight: 600, marginBottom: "1.8vh" }}>AI-powered analysis + drafting</div>
            <div style={{ color: "#111111", fontSize: "1.55vw", fontWeight: 600 }}>Partner RBAC portal</div>
          </div>
          <div style={{ flex: 1, borderTop: "3px solid #EE6C4D", paddingTop: "3vh" }}>
            <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "2.5vh" }}>User Roles</div>
            <div style={{ marginBottom: "2vh" }}>
              <div style={{ color: "#3D5A80", fontSize: "1.5vw", fontWeight: 700 }}>admin</div>
              <div style={{ color: "#666666", fontSize: "1.3vw" }}>Full platform access</div>
            </div>
            <div style={{ marginBottom: "2vh" }}>
              <div style={{ color: "#3D5A80", fontSize: "1.5vw", fontWeight: 700 }}>ops</div>
              <div style={{ color: "#666666", fontSize: "1.3vw" }}>Operational access, no admin</div>
            </div>
            <div style={{ marginBottom: "2vh" }}>
              <div style={{ color: "#3D5A80", fontSize: "1.5vw", fontWeight: 700 }}>customer</div>
              <div style={{ color: "#666666", fontSize: "1.3vw" }}>Scoped to own data</div>
            </div>
            <div>
              <div style={{ color: "#3D5A80", fontSize: "1.5vw", fontWeight: 700 }}>telecom_services_partner</div>
              <div style={{ color: "#666666", fontSize: "1.3vw" }}>Multi-customer, read-only portal</div>
            </div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", color: "#999999", fontSize: "0.9vw", fontWeight: 600 }}>02</div>
    </div>
  );
}

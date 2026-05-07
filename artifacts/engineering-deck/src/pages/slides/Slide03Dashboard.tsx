const G = "repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)";
const base = import.meta.env.BASE_URL;

export default function Slide03Dashboard() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", fontFamily: "'Inter', sans-serif", backgroundImage: G }}>
      <div style={{ position: "absolute", top: "5vh", left: "5vw", width: "3vw", height: "3vw", backgroundColor: "#3D5A80" }} />
      <div style={{ position: "absolute", top: "5vh", right: "5vw", textAlign: "right" }}>
        <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5vh" }}>Service Assurance AI</div>
        <div style={{ color: "#999999", fontSize: "0.9vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Engineering Handoff / May 2026</div>
      </div>
      <div style={{ position: "absolute", top: "18vh", left: "5vw", right: "5vw", bottom: "10vh", display: "flex", gap: "4vw" }}>
        <div style={{ flex: "0 0 57vw" }}>
          <h2 style={{ color: "#111111", fontSize: "3vw", margin: "0 0 2vh 0", fontWeight: 700, letterSpacing: "-0.02em" }}>Operations Dashboard</h2>
          <img src={`${base}screen-dashboard.jpg`} crossOrigin="anonymous" alt="Dashboard screenshot" style={{ width: "57vw", height: "58vh", objectFit: "cover", objectPosition: "top", border: "1px solid #E0E0E0" }} />
        </div>
        <div style={{ flex: 1, paddingTop: "6vh" }}>
          <div style={{ marginBottom: "3.5vh" }}>
            <div style={{ width: "2vw", height: "3px", backgroundColor: "#3D5A80", marginBottom: "1.5vh" }} />
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600, marginBottom: "0.8vh" }}>KPI Stat Cards</div>
            <div style={{ color: "#666666", fontSize: "1.3vw", lineHeight: 1.5 }}>Open tickets, escalated, avg resolution time, SLA breach rate</div>
          </div>
          <div style={{ marginBottom: "3.5vh" }}>
            <div style={{ width: "2vw", height: "3px", backgroundColor: "#98C1D9", marginBottom: "1.5vh" }} />
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600, marginBottom: "0.8vh" }}>Recent Tickets</div>
            <div style={{ color: "#666666", fontSize: "1.3vw", lineHeight: 1.5 }}>Live feed of recent ticket activity across all customers</div>
          </div>
          <div>
            <div style={{ width: "2vw", height: "3px", backgroundColor: "#EE6C4D", marginBottom: "1.5vh" }} />
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600, marginBottom: "0.8vh" }}>Escalation Queue</div>
            <div style={{ color: "#666666", fontSize: "1.3vw", lineHeight: 1.5 }}>Tickets flagged for escalation or approaching SLA breach</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", color: "#999999", fontSize: "0.9vw", fontWeight: 600 }}>03</div>
    </div>
  );
}

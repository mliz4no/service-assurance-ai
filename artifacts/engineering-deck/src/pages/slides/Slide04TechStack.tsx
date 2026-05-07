const G = "repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)";

export default function Slide04TechStack() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", fontFamily: "'Inter', sans-serif", backgroundImage: G }}>
      <div style={{ position: "absolute", top: "5vh", left: "5vw", width: "3vw", height: "3vw", backgroundColor: "#3D5A80" }} />
      <div style={{ position: "absolute", top: "5vh", right: "5vw", textAlign: "right" }}>
        <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5vh" }}>Service Assurance AI</div>
        <div style={{ color: "#999999", fontSize: "0.9vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Engineering Handoff / May 2026</div>
      </div>
      <div style={{ position: "absolute", top: "18vh", left: "10vw", width: "80vw" }}>
        <h2 style={{ color: "#111111", fontSize: "4vw", margin: "0 0 4vh 0", fontWeight: 700, letterSpacing: "-0.02em" }}>Tech Stack</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5vh" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2vw", borderBottom: "1px solid #E0E0E0", paddingBottom: "1.5vh" }}>
            <div style={{ flex: "0 0 14vw", color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Frontend</div>
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600 }}>React 18</div>
            <div style={{ color: "#666666", fontSize: "1.4vw" }}>Vite · Tailwind CSS · shadcn/ui · TanStack Query · Wouter · Leaflet · Recharts</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2vw", borderBottom: "1px solid #E0E0E0", paddingBottom: "1.5vh" }}>
            <div style={{ flex: "0 0 14vw", color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Backend</div>
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600 }}>Node.js + Express 5</div>
            <div style={{ color: "#666666", fontSize: "1.4vw" }}>TypeScript · ESBuild (bundled) · Pino structured logging</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2vw", borderBottom: "1px solid #E0E0E0", paddingBottom: "1.5vh" }}>
            <div style={{ flex: "0 0 14vw", color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Database</div>
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600 }}>PostgreSQL</div>
            <div style={{ color: "#666666", fontSize: "1.4vw" }}>Drizzle ORM · drizzle-kit (push-based) · 17 tables · no migration runner</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2vw", borderBottom: "1px solid #E0E0E0", paddingBottom: "1.5vh" }}>
            <div style={{ flex: "0 0 14vw", color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Auth</div>
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600 }}>Bearer token</div>
            <div style={{ color: "#666666", fontSize: "1.4vw" }}>scrypt password hashing · in-memory session store · RBAC 4 roles</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2vw", borderBottom: "1px solid #E0E0E0", paddingBottom: "1.5vh" }}>
            <div style={{ flex: "0 0 14vw", color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI</div>
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600 }}>OpenAI gpt-4o-mini</div>
            <div style={{ color: "#666666", fontSize: "1.4vw" }}>Synchronous in-request calls · ticket summary, normalization, drafting, event analysis</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "2vw" }}>
            <div style={{ flex: "0 0 14vw", color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Integrations</div>
            <div style={{ color: "#111111", fontSize: "1.5vw", fontWeight: 600 }}>Cisco Meraki, Fortinet</div>
            <div style={{ color: "#666666", fontSize: "1.4vw" }}>REST API polling · demo mode (placeholder key) · live key = live data</div>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", color: "#999999", fontSize: "0.9vw", fontWeight: 600 }}>04</div>
    </div>
  );
}

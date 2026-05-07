const G = "repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)";
const base = import.meta.env.BASE_URL;

export default function Slide15PartnerRbac() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", fontFamily: "'Inter', sans-serif", backgroundImage: G }}>
      <div style={{ position: "absolute", top: "5vh", left: "5vw", width: "3vw", height: "3vw", backgroundColor: "#3D5A80" }} />
      <div style={{ position: "absolute", top: "5vh", right: "5vw", textAlign: "right" }}>
        <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5vh" }}>Service Assurance AI</div>
        <div style={{ color: "#999999", fontSize: "0.9vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Engineering Handoff / May 2026</div>
      </div>
      <div style={{ position: "absolute", top: "18vh", left: "5vw", right: "5vw", bottom: "10vh", display: "flex", gap: "4vw" }}>
        <div style={{ flex: "0 0 26vw" }}>
          <h2 style={{ color: "#111111", fontSize: "3vw", margin: "0 0 3vh 0", fontWeight: 700, letterSpacing: "-0.02em" }}>Partner RBAC</h2>
          <div style={{ marginBottom: "2.5vh" }}>
            <div style={{ color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1vh" }}>How Scoping Works</div>
            <div style={{ color: "#666666", fontSize: "1.25vw", lineHeight: 1.7 }}>Partner org links to customers via telecomServicesPartnerId. On login, auth middleware injects req.partnerCustomerIds[] — all API list routes filter by inArray(customerId, pIds).</div>
          </div>
          <div style={{ marginBottom: "2.5vh" }}>
            <div style={{ color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1vh" }}>Partner Restrictions</div>
            <div style={{ color: "#666666", fontSize: "1.2vw", lineHeight: 1.7 }}>No writes on tickets, services, customers</div>
            <div style={{ color: "#666666", fontSize: "1.2vw", lineHeight: 1.7 }}>Controllers, network-links, events: 403</div>
            <div style={{ color: "#666666", fontSize: "1.2vw", lineHeight: 1.7 }}>Internal customer notes stripped</div>
            <div style={{ color: "#666666", fontSize: "1.2vw", lineHeight: 1.7 }}>InternalOnlyRoute blocks /dashboard, /admin</div>
          </div>
          <div>
            <div style={{ color: "#3D5A80", fontSize: "1.1vw", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "1vh" }}>Demo Credentials</div>
            <div style={{ fontFamily: "monospace", fontSize: "1.2vw", color: "#111111", marginBottom: "0.3vh" }}>partneradmin@nexatek.com</div>
            <div style={{ fontFamily: "monospace", fontSize: "1.2vw", color: "#666666" }}>Acme123! — sees 2 customers</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <img src={`${base}screen-admin.jpg`} crossOrigin="anonymous" alt="Admin panel screenshot" style={{ width: "100%", height: "72vh", objectFit: "cover", objectPosition: "top", border: "1px solid #E0E0E0" }} />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: "4vh", left: "5vw", color: "#999999", fontSize: "0.9vw", fontWeight: 600 }}>15</div>
    </div>
  );
}

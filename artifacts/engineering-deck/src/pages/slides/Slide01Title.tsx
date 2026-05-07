const G = "repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)";

export default function Slide01Title() {
  return (
    <div className="w-screen h-screen overflow-hidden relative" style={{ backgroundColor: "#FFFFFF", fontFamily: "'Inter', sans-serif", backgroundImage: G }}>
      <div style={{ position: "absolute", top: "5vh", left: "5vw", width: "3vw", height: "3vw", backgroundColor: "#3D5A80" }} />
      <div style={{ position: "absolute", top: "5vh", right: "5vw", textAlign: "right" }}>
        <div style={{ color: "#3D5A80", fontSize: "1vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5vh" }}>Service Assurance AI</div>
        <div style={{ color: "#999999", fontSize: "0.9vw", textTransform: "uppercase", letterSpacing: "0.1em" }}>Engineering Handoff / May 2026</div>
      </div>
      <div style={{ position: "absolute", bottom: "10vh", left: "10vw", maxWidth: "70vw" }}>
        <div style={{ color: "#3D5A80", fontSize: "1.2vw", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "3vh" }}>serviceassurance.ai</div>
        <h1 style={{ color: "#111111", fontSize: "7.5vw", margin: "0 0 3vh 0", fontWeight: 800, lineHeight: 1.0, letterSpacing: "-0.04em", textWrap: "balance" }}>
          Service Assurance AI
        </h1>
        <p style={{ color: "#666666", fontSize: "1.8vw", margin: 0, fontWeight: 400, lineHeight: 1.4, maxWidth: "55vw" }}>
          Engineering Handoff — Platform Architecture, Codebase Overview &amp; Development Roadmap
        </p>
      </div>
      <div style={{ position: "absolute", bottom: "4vh", right: "5vw", color: "#999999", fontSize: "0.9vw", fontWeight: 600 }}>01</div>
    </div>
  );
}

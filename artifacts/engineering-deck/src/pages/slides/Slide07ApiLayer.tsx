const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';

export default function Slide07ApiLayer() {
  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{ backgroundColor: '#FFFFFF', fontFamily: "'Inter', sans-serif", backgroundImage: G }}
    >
      <div
        style={{
          position: 'absolute',
          top: '5vh',
          left: '5vw',
          width: '3vw',
          height: '3vw',
          backgroundColor: '#3D5A80',
        }}
      />
      <div style={{ position: 'absolute', top: '5vh', right: '5vw', textAlign: 'right' }}>
        <div
          style={{
            color: '#3D5A80',
            fontSize: '1vw',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '0.5vh',
          }}
        >
          Service Assurance AI
        </div>
        <div
          style={{
            color: '#999999',
            fontSize: '0.9vw',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          Engineering Handoff / May 2026
        </div>
      </div>
      <div style={{ position: 'absolute', top: '18vh', left: '10vw', width: '80vw' }}>
        <h2
          style={{
            color: '#111111',
            fontSize: '4vw',
            margin: '0 0 1vh 0',
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          API Layer
        </h2>
        <p style={{ color: '#666666', fontSize: '1.4vw', margin: '0 0 3vh 0' }}>
          Express 5 — all routes under /api — handlers in artifacts/api-server/src/routes/
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3vw' }}>
          <div>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1.5vh',
                borderBottom: '2px solid #3D5A80',
                paddingBottom: '0.8vh',
              }}
            >
              Core CRUD
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /auth/login, /auth/me
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              POST login, GET current user
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /customers, /sites, /services
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              Full CRUD, partner-scoped
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /tickets, /ticket-updates
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              Full CRUD + timeline
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /sla-policies
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw' }}>SLA definition CRUD</div>
          </div>
          <div>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1.5vh',
                borderBottom: '2px solid #98C1D9',
                paddingBottom: '0.8vh',
              }}
            >
              Controllers
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /controllers
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              CRUD + /test + /sync
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /devices
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              GET list + GET/PUT detail
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /network-links
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              WAN uplinks, VPN tunnels
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /device-events
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw' }}>Events + /:id/ai-analyze</div>
          </div>
          <div>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1.5vh',
                borderBottom: '2px solid #EE6C4D',
                paddingBottom: '0.8vh',
              }}
            >
              ITIL + AI
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /customers/:id/contacts
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              Escalation contacts CRUD
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /tickets/:id/notifications
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              GET escalation log
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /tickets/:id/evaluate-escalation
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              POST trigger re-evaluation
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                fontWeight: 600,
                marginBottom: '0.3vh',
              }}
            >
              /escalation-matrix
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw' }}>GET + PUT matrix overrides</div>
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: '4vh',
          left: '5vw',
          color: '#999999',
          fontSize: '0.9vw',
          fontWeight: 600,
        }}
      >
        07
      </div>
    </div>
  );
}

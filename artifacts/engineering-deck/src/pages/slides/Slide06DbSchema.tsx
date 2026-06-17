const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';

export default function Slide06DbSchema() {
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
          Database Schema
        </h2>
        <p style={{ color: '#666666', fontSize: '1.4vw', margin: '0 0 3vh 0' }}>
          17 tables in PostgreSQL — schema at lib/db/src/schema/index.ts
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '2vw' }}>
          <div style={{ borderTop: '3px solid #3D5A80', paddingTop: '2vh' }}>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1.5vh',
              }}
            >
              Core Entities
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              customers
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              sites
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              services
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              sla_policies
            </div>
          </div>
          <div style={{ borderTop: '3px solid #98C1D9', paddingTop: '2vh' }}>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1.5vh',
              }}
            >
              Tickets + ITIL
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              tickets
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              ticket_updates
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              customer_contacts
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              escalation_notifications
            </div>
            <div style={{ color: '#111111', fontSize: '1.3vw', fontFamily: 'monospace' }}>
              escalation_matrix_overrides
            </div>
          </div>
          <div style={{ borderTop: '3px solid #EE6C4D', paddingTop: '2vh' }}>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1.5vh',
              }}
            >
              Controllers
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              controllers
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              managed_devices
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              network_links
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              device_events
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              controller_sync_logs
            </div>
            <div style={{ color: '#111111', fontSize: '1.3vw', fontFamily: 'monospace' }}>
              incident_correlations
            </div>
          </div>
          <div style={{ borderTop: '3px solid #999999', paddingTop: '2vh' }}>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1.5vh',
              }}
            >
              Auth + Partners
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.3vw',
                marginBottom: '0.8vh',
                fontFamily: 'monospace',
              }}
            >
              users
            </div>
            <div style={{ color: '#111111', fontSize: '1.3vw', fontFamily: 'monospace' }}>
              telecom_services_partners
            </div>
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
        06
      </div>
    </div>
  );
}

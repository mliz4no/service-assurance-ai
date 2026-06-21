const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';

export default function Slide16ScaleCeiling() {
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
          Scale Ceiling
        </h2>
        <p style={{ color: '#666666', fontSize: '1.4vw', margin: '0 0 3vh 0' }}>
          Current architecture handles ~1,500–2,000 devices comfortably. Here is what breaks at each
          tier.
        </p>
        <div style={{ borderTop: '2px solid #E0E0E0' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '14vw 1fr 1fr',
              gap: '0',
              borderBottom: '1px solid #E0E0E0',
              padding: '1.2vh 0',
            }}
          >
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              Range
            </div>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              Status
            </div>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}
            >
              What to fix
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '14vw 1fr 1fr',
              gap: '0',
              borderBottom: '1px solid #E0E0E0',
              padding: '1.8vh 0',
              backgroundColor: '#F8FFF8',
            }}
          >
            <div style={{ color: '#155724', fontSize: '1.5vw', fontWeight: 700 }}>&lt; 500</div>
            <div style={{ color: '#666666', fontSize: '1.3vw' }}>Comfortable — no issues</div>
            <div style={{ color: '#999999', fontSize: '1.3vw' }}>DB indexes help</div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '14vw 1fr 1fr',
              gap: '0',
              borderBottom: '1px solid #E0E0E0',
              padding: '1.8vh 0',
            }}
          >
            <div style={{ color: '#856404', fontSize: '1.5vw', fontWeight: 700 }}>500–2,000</div>
            <div style={{ color: '#666666', fontSize: '1.3vw' }}>
              device_events table grows fast; UI slows without pagination
            </div>
            <div style={{ color: '#666666', fontSize: '1.3vw' }}>
              DB composite indexes, enforce pagination
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '14vw 1fr 1fr',
              gap: '0',
              borderBottom: '1px solid #E0E0E0',
              padding: '1.8vh 0',
              backgroundColor: '#FFF8F5',
            }}
          >
            <div style={{ color: '#EE6C4D', fontSize: '1.5vw', fontWeight: 700 }}>2,000–5,000</div>
            <div style={{ color: '#666666', fontSize: '1.3vw' }}>
              Sync jobs block event loop; Postgres connections saturate
            </div>
            <div style={{ color: '#666666', fontSize: '1.3vw' }}>
              PgBouncer, async job queue (BullMQ + Redis)
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '14vw 1fr 1fr',
              gap: '0',
              padding: '1.8vh 0',
              backgroundColor: '#FFF2F2',
            }}
          >
            <div style={{ color: '#721C24', fontSize: '1.5vw', fontWeight: 700 }}>5,000+</div>
            <div style={{ color: '#666666', fontSize: '1.3vw' }}>
              Synchronous polling collapses; single process is the ceiling
            </div>
            <div style={{ color: '#666666', fontSize: '1.3vw' }}>
              Kafka/NATS ingest, containerize, horizontal scale
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: '2.5vh',
            padding: '1.5vh 2vw',
            backgroundColor: '#F8F9FA',
            border: '1px solid #E0E0E0',
            fontSize: '1.3vw',
            color: '#666666',
          }}
        >
          <span style={{ color: '#3D5A80', fontWeight: 600 }}>
            Quick wins (no architecture change):
          </span>{' '}
          composite DB indexes on customerId/siteId/status/createdAt + swap in-memory session store
          for Redis — adds ~1 day of effort, raises ceiling to ~4,000 devices.
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
        16
      </div>
    </div>
  );
}

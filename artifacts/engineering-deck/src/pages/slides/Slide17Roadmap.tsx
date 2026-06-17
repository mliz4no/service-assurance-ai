const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';

export default function Slide17Roadmap() {
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
          Engineering Roadmap
        </h2>
        <p style={{ color: '#666666', fontSize: '1.4vw', margin: '0 0 3vh 0' }}>
          Prioritized by impact. Items 1–2 are low-risk quick wins. Items 3–7 require architectural
          work.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2vw' }}>
          <div>
            <div
              style={{
                display: 'flex',
                gap: '1.5vw',
                alignItems: 'flex-start',
                borderBottom: '1px solid #E0E0E0',
                paddingBottom: '1.8vh',
                marginBottom: '1.8vh',
              }}
            >
              <div
                style={{
                  color: '#3D5A80',
                  fontSize: '2.5vw',
                  fontWeight: 800,
                  lineHeight: 1,
                  flex: '0 0 3vw',
                }}
              >
                1
              </div>
              <div>
                <div
                  style={{
                    color: '#111111',
                    fontSize: '1.4vw',
                    fontWeight: 600,
                    marginBottom: '0.3vh',
                  }}
                >
                  Redis session store + BullMQ
                </div>
                <div style={{ color: '#666666', fontSize: '1.2vw' }}>
                  Replace in-memory sessions. Enables horizontal scaling and persistent jobs.
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '1.5vw',
                alignItems: 'flex-start',
                borderBottom: '1px solid #E0E0E0',
                paddingBottom: '1.8vh',
                marginBottom: '1.8vh',
              }}
            >
              <div
                style={{
                  color: '#3D5A80',
                  fontSize: '2.5vw',
                  fontWeight: 800,
                  lineHeight: 1,
                  flex: '0 0 3vw',
                }}
              >
                2
              </div>
              <div>
                <div
                  style={{
                    color: '#111111',
                    fontSize: '1.4vw',
                    fontWeight: 600,
                    marginBottom: '0.3vh',
                  }}
                >
                  DB indexes + PgBouncer
                </div>
                <div style={{ color: '#666666', fontSize: '1.2vw' }}>
                  Composite indexes on high-cardinality filter columns. Connection pooler in front
                  of Postgres.
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '1.5vw',
                alignItems: 'flex-start',
                borderBottom: '1px solid #E0E0E0',
                paddingBottom: '1.8vh',
                marginBottom: '1.8vh',
              }}
            >
              <div
                style={{
                  color: '#3D5A80',
                  fontSize: '2.5vw',
                  fontWeight: 800,
                  lineHeight: 1,
                  flex: '0 0 3vw',
                }}
              >
                3
              </div>
              <div>
                <div
                  style={{
                    color: '#111111',
                    fontSize: '1.4vw',
                    fontWeight: 600,
                    marginBottom: '0.3vh',
                  }}
                >
                  Async AI jobs
                </div>
                <div style={{ color: '#666666', fontSize: '1.2vw' }}>
                  Move AI calls off the HTTP request path. Return job ID, poll or push result when
                  ready.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5vw', alignItems: 'flex-start' }}>
              <div
                style={{
                  color: '#3D5A80',
                  fontSize: '2.5vw',
                  fontWeight: 800,
                  lineHeight: 1,
                  flex: '0 0 3vw',
                }}
              >
                4
              </div>
              <div>
                <div
                  style={{
                    color: '#111111',
                    fontSize: '1.4vw',
                    fontWeight: 600,
                    marginBottom: '0.3vh',
                  }}
                >
                  Salesforce / ServiceNow connectors
                </div>
                <div style={{ color: '#666666', fontSize: '1.2vw' }}>
                  Customer/site/circuit import + ticket bi-directional sync. OAuth credential store
                  needed first.
                </div>
              </div>
            </div>
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                gap: '1.5vw',
                alignItems: 'flex-start',
                borderBottom: '1px solid #E0E0E0',
                paddingBottom: '1.8vh',
                marginBottom: '1.8vh',
              }}
            >
              <div
                style={{
                  color: '#98C1D9',
                  fontSize: '2.5vw',
                  fontWeight: 800,
                  lineHeight: 1,
                  flex: '0 0 3vw',
                }}
              >
                5
              </div>
              <div>
                <div
                  style={{
                    color: '#111111',
                    fontSize: '1.4vw',
                    fontWeight: 600,
                    marginBottom: '0.3vh',
                  }}
                >
                  Kafka / NATS ingest pipeline
                </div>
                <div style={{ color: '#666666', fontSize: '1.2vw' }}>
                  Replace synchronous vendor polling with event streaming. Batch writer consumer.
                  Unlocks 10k+ devices.
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '1.5vw',
                alignItems: 'flex-start',
                borderBottom: '1px solid #E0E0E0',
                paddingBottom: '1.8vh',
                marginBottom: '1.8vh',
              }}
            >
              <div
                style={{
                  color: '#98C1D9',
                  fontSize: '2.5vw',
                  fontWeight: 800,
                  lineHeight: 1,
                  flex: '0 0 3vw',
                }}
              >
                6
              </div>
              <div>
                <div
                  style={{
                    color: '#111111',
                    fontSize: '1.4vw',
                    fontWeight: 600,
                    marginBottom: '0.3vh',
                  }}
                >
                  WebSocket real-time push
                </div>
                <div style={{ color: '#666666', fontSize: '1.2vw' }}>
                  Replace UI polling with server-push for live device status and ticket updates.
                  Socket.io or SSE.
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '1.5vw',
                alignItems: 'flex-start',
                borderBottom: '1px solid #E0E0E0',
                paddingBottom: '1.8vh',
                marginBottom: '1.8vh',
              }}
            >
              <div
                style={{
                  color: '#98C1D9',
                  fontSize: '2.5vw',
                  fontWeight: 800,
                  lineHeight: 1,
                  flex: '0 0 3vw',
                }}
              >
                7
              </div>
              <div>
                <div
                  style={{
                    color: '#111111',
                    fontSize: '1.4vw',
                    fontWeight: 600,
                    marginBottom: '0.3vh',
                  }}
                >
                  Containerize + horizontal scaling
                </div>
                <div style={{ color: '#666666', fontSize: '1.2vw' }}>
                  Docker + load balancer. Stateless API workers. Multi-region Postgres (Neon or RDS
                  Multi-AZ).
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1.5vw', alignItems: 'flex-start' }}>
              <div
                style={{
                  color: '#EE6C4D',
                  fontSize: '2.5vw',
                  fontWeight: 800,
                  lineHeight: 1,
                  flex: '0 0 3vw',
                }}
              >
                8
              </div>
              <div>
                <div
                  style={{
                    color: '#111111',
                    fontSize: '1.4vw',
                    fontWeight: 600,
                    marginBottom: '0.3vh',
                  }}
                >
                  TimescaleDB / Postgres partitioning
                </div>
                <div style={{ color: '#666666', fontSize: '1.2vw' }}>
                  Partition device_events + network_links by time. Retention policy. Required at
                  100k+ devices.
                </div>
              </div>
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
        17
      </div>
    </div>
  );
}

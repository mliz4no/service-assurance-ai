const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';

export default function Slide05Monorepo() {
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
          Monorepo Architecture
        </h2>
        <p style={{ color: '#666666', fontSize: '1.4vw', margin: '0 0 4vh 0' }}>
          pnpm workspaces — managed by a shared reverse proxy routing traffic by path.
        </p>
        <div style={{ display: 'flex', gap: '5vw' }}>
          <div style={{ flex: '0 0 36vw' }}>
            <div
              style={{
                backgroundColor: '#F8F9FA',
                border: '1px solid #E0E0E0',
                padding: '2.5vw',
                fontFamily: 'monospace',
              }}
            >
              <div style={{ color: '#999999', fontSize: '1.3vw', marginBottom: '1vh' }}>
                workspace-root/
              </div>
              <div
                style={{
                  color: '#3D5A80',
                  fontSize: '1.4vw',
                  fontWeight: 700,
                  marginBottom: '0.5vh',
                }}
              >
                {' '}
                artifacts/
              </div>
              <div style={{ color: '#111111', fontSize: '1.3vw', marginBottom: '0.3vh' }}>
                {' '}
                api-server/
              </div>
              <div style={{ color: '#111111', fontSize: '1.3vw', marginBottom: '0.8vh' }}>
                {' '}
                service-assurance/
              </div>
              <div
                style={{
                  color: '#3D5A80',
                  fontSize: '1.4vw',
                  fontWeight: 700,
                  marginBottom: '0.5vh',
                }}
              >
                {' '}
                lib/
              </div>
              <div style={{ color: '#111111', fontSize: '1.3vw', marginBottom: '0.3vh' }}> db/</div>
              <div style={{ color: '#111111', fontSize: '1.3vw', marginBottom: '0.3vh' }}>
                {' '}
                api-spec/
              </div>
              <div style={{ color: '#111111', fontSize: '1.3vw', marginBottom: '0.8vh' }}>
                {' '}
                api-client-react/
              </div>
              <div
                style={{
                  color: '#3D5A80',
                  fontSize: '1.4vw',
                  fontWeight: 700,
                  marginBottom: '0.5vh',
                }}
              >
                {' '}
                scripts/
              </div>
              <div style={{ color: '#111111', fontSize: '1.3vw' }}> seed.ts</div>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2vh' }}>
            <div style={{ borderLeft: '3px solid #3D5A80', paddingLeft: '1.5vw' }}>
              <div
                style={{
                  color: '#111111',
                  fontSize: '1.5vw',
                  fontWeight: 600,
                  marginBottom: '0.4vh',
                }}
              >
                api-server
              </div>
              <div style={{ color: '#666666', fontSize: '1.3vw' }}>
                Express 5 REST API — port 8080 — proxied at /api
              </div>
            </div>
            <div style={{ borderLeft: '3px solid #3D5A80', paddingLeft: '1.5vw' }}>
              <div
                style={{
                  color: '#111111',
                  fontSize: '1.5vw',
                  fontWeight: 600,
                  marginBottom: '0.4vh',
                }}
              >
                service-assurance
              </div>
              <div style={{ color: '#666666', fontSize: '1.3vw' }}>
                React + Vite frontend — serves at / — static on deploy
              </div>
            </div>
            <div style={{ borderLeft: '3px solid #98C1D9', paddingLeft: '1.5vw' }}>
              <div
                style={{
                  color: '#111111',
                  fontSize: '1.5vw',
                  fontWeight: 600,
                  marginBottom: '0.4vh',
                }}
              >
                lib/db
              </div>
              <div style={{ color: '#666666', fontSize: '1.3vw' }}>
                Drizzle ORM schema + DB client shared by api-server
              </div>
            </div>
            <div style={{ borderLeft: '3px solid #98C1D9', paddingLeft: '1.5vw' }}>
              <div
                style={{
                  color: '#111111',
                  fontSize: '1.5vw',
                  fontWeight: 600,
                  marginBottom: '0.4vh',
                }}
              >
                lib/api-spec + api-client-react
              </div>
              <div style={{ color: '#666666', fontSize: '1.3vw' }}>
                OpenAPI 3.1 spec → codegen → React Query hooks + Zod schemas
              </div>
            </div>
            <div style={{ borderLeft: '3px solid #999999', paddingLeft: '1.5vw' }}>
              <div
                style={{
                  color: '#111111',
                  fontSize: '1.5vw',
                  fontWeight: 600,
                  marginBottom: '0.4vh',
                }}
              >
                scripts
              </div>
              <div style={{ color: '#666666', fontSize: '1.3vw' }}>
                Seed script — also imported by api-server for auto-seed on first boot
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
        05
      </div>
    </div>
  );
}

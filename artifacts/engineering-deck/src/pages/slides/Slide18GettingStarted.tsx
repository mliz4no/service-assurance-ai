const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';

export default function Slide18GettingStarted() {
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
          Getting Started
        </h2>
        <p style={{ color: '#666666', fontSize: '1.4vw', margin: '0 0 3vh 0' }}>
          Key commands, files, and credentials for onboarding.
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
              Run Commands
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.15vw',
                color: '#111111',
                marginBottom: '0.5vh',
              }}
            >
              pnpm install
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.5vh' }}>
              Install all workspace deps
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.15vw',
                color: '#111111',
                marginBottom: '0.5vh',
              }}
            >
              pnpm --filter @workspace/db run push
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.5vh' }}>
              Push schema to Postgres
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.15vw',
                color: '#111111',
                marginBottom: '0.5vh',
              }}
            >
              pnpm --filter @workspace/scripts run seed
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.5vh' }}>
              Seed the database
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.15vw',
                color: '#111111',
                marginBottom: '0.5vh',
              }}
            >
              pnpm run typecheck
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw' }}>
              Full typecheck (libs + artifacts)
            </div>
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
              Key Files
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.1vw',
                color: '#3D5A80',
                marginBottom: '0.3vh',
              }}
            >
              lib/db/src/schema/index.ts
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.2vh' }}>
              All Drizzle table definitions
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.1vw',
                color: '#3D5A80',
                marginBottom: '0.3vh',
              }}
            >
              artifacts/api-server/src/routes/
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.2vh' }}>
              All API route handlers
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.1vw',
                color: '#3D5A80',
                marginBottom: '0.3vh',
              }}
            >
              artifacts/api-server/src/middlewares/auth.ts
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.2vh' }}>
              RBAC enforcement hub
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.1vw',
                color: '#3D5A80',
                marginBottom: '0.3vh',
              }}
            >
              artifacts/service-assurance/src/App.tsx
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw' }}>
              Frontend router + ProtectedRoute
            </div>
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
              Demo Credentials
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.15vw',
                color: '#111111',
                marginBottom: '0.2vh',
              }}
            >
              admin@serviceassurance.ai
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.5vh' }}>
              Admin123! — full access
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.15vw',
                color: '#111111',
                marginBottom: '0.2vh',
              }}
            >
              ops@serviceassurance.ai
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.5vh' }}>
              Ops123! — ops access
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.15vw',
                color: '#111111',
                marginBottom: '0.2vh',
              }}
            >
              partneradmin@nexatek.com
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw', marginBottom: '1.5vh' }}>
              Acme123! — partner portal
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.15vw',
                color: '#111111',
                marginBottom: '0.2vh',
              }}
            >
              OPENAI_API_KEY
            </div>
            <div style={{ color: '#666666', fontSize: '1.1vw' }}>Required for AI features</div>
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
        18
      </div>
    </div>
  );
}

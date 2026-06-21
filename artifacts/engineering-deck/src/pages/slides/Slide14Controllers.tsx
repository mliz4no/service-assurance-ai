const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';
const base = import.meta.env.BASE_URL;

export default function Slide14Controllers() {
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
      <div
        style={{
          position: 'absolute',
          top: '18vh',
          left: '5vw',
          right: '5vw',
          bottom: '10vh',
          display: 'flex',
          gap: '4vw',
        }}
      >
        <div style={{ flex: '0 0 26vw' }}>
          <h2
            style={{
              color: '#111111',
              fontSize: '3vw',
              margin: '0 0 3vh 0',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            Controller Module
          </h2>
          <div style={{ marginBottom: '2.5vh' }}>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1vh',
              }}
            >
              Vendors Supported
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.4vw',
                fontWeight: 600,
                marginBottom: '0.4vh',
              }}
            >
              Cisco Meraki
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', marginBottom: '1.2vh' }}>
              REST API — real key = live data, "placeholder" = demo mode
            </div>
            <div
              style={{
                color: '#111111',
                fontSize: '1.4vw',
                fontWeight: 600,
                marginBottom: '0.4vh',
              }}
            >
              Fortinet
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw' }}>
              REST API — demo mode only (seeded events)
            </div>
          </div>
          <div style={{ marginBottom: '2.5vh' }}>
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.1vw',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                marginBottom: '1vh',
              }}
            >
              Data Captured
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.7 }}>
              Device inventory + status
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.7 }}>
              WAN uplinks, VPN tunnels, LTE backup
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.7 }}>
              Controller events with severity
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.7 }}>
              Incident correlation to tickets
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
                marginBottom: '1vh',
              }}
            >
              Hooks
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', fontFamily: 'monospace' }}>
              src/lib/controller-hooks.ts
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <img
            src={`${base}screen-events.jpg`}
            crossOrigin="anonymous"
            alt="Event monitor screenshot"
            style={{
              width: '100%',
              height: '72vh',
              objectFit: 'cover',
              objectPosition: 'top',
              border: '1px solid #E0E0E0',
            }}
          />
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
        14
      </div>
    </div>
  );
}

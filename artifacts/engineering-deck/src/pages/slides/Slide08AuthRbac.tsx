const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';

export default function Slide08AuthRbac() {
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
          Authentication &amp; RBAC
        </h2>
        <p style={{ color: '#666666', fontSize: '1.4vw', margin: '0 0 3.5vh 0' }}>
          Bearer token auth — stored in localStorage as sa_auth_token — validated in Express
          middleware.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '2vw' }}>
          <div style={{ border: '1px solid #E0E0E0', padding: '2.5vw' }}>
            <div
              style={{
                width: '2vw',
                height: '2vw',
                backgroundColor: '#3D5A80',
                marginBottom: '2vh',
              }}
            />
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.5vw',
                fontWeight: 700,
                marginBottom: '1vh',
                fontFamily: 'monospace',
              }}
            >
              admin
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              Full platform access
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              All CRUD operations
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              User + partner management
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              SLA + matrix config
            </div>
          </div>
          <div style={{ border: '1px solid #E0E0E0', padding: '2.5vw' }}>
            <div
              style={{
                width: '2vw',
                height: '2vw',
                backgroundColor: '#98C1D9',
                marginBottom: '2vh',
              }}
            />
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.5vw',
                fontWeight: 700,
                marginBottom: '1vh',
                fontFamily: 'monospace',
              }}
            >
              ops
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>Ticket CRUD</div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              Controller access
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              No admin panel
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              No partner management
            </div>
          </div>
          <div style={{ border: '1px solid #E0E0E0', padding: '2.5vw' }}>
            <div
              style={{
                width: '2vw',
                height: '2vw',
                backgroundColor: '#EE6C4D',
                marginBottom: '2vh',
              }}
            />
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.5vw',
                fontWeight: 700,
                marginBottom: '1vh',
                fontFamily: 'monospace',
              }}
            >
              customer
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              Own tickets + sites only
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              Scoped by customerId
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              Read-only services
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              No controller access
            </div>
          </div>
          <div style={{ border: '1px solid #E0E0E0', padding: '2.5vw' }}>
            <div
              style={{
                width: '2vw',
                height: '2vw',
                backgroundColor: '#7B5EA7',
                marginBottom: '2vh',
              }}
            />
            <div
              style={{
                color: '#3D5A80',
                fontSize: '1.3vw',
                fontWeight: 700,
                marginBottom: '1vh',
                fontFamily: 'monospace',
              }}
            >
              telecom_services_partner
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              Multi-customer portal
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              Scoped by partnerCustomerIds[]
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              No writes on tickets/services
            </div>
            <div style={{ color: '#666666', fontSize: '1.2vw', lineHeight: 1.6 }}>
              Controllers blocked (403)
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
          <span style={{ color: '#3D5A80', fontWeight: 600 }}>Key file:</span>{' '}
          artifacts/api-server/src/middlewares/auth.ts — injects req.user + req.partnerCustomerIds[]
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
        08
      </div>
    </div>
  );
}

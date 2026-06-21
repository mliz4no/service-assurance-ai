const G =
  'repeating-linear-gradient(to right,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vw),repeating-linear-gradient(to bottom,#F0F0F0 0,#F0F0F0 1px,transparent 1px,transparent 5vh)';

export default function Slide10ItilMatrix() {
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
          ITIL Severity Matrix
        </h2>
        <p style={{ color: '#666666', fontSize: '1.4vw', margin: '0 0 3vh 0' }}>
          Impact × Urgency → Severity — configurable per scope. Scope hierarchy: circuit → site →
          customer → global → default.
        </p>
        <div style={{ display: 'flex', gap: '6vw', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: '0', marginBottom: '0' }}>
              <div style={{ width: '8vw' }} />
              <div
                style={{
                  width: '10vw',
                  textAlign: 'center',
                  color: '#3D5A80',
                  fontSize: '1.1vw',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  paddingBottom: '1vh',
                }}
              >
                Low
              </div>
              <div
                style={{
                  width: '10vw',
                  textAlign: 'center',
                  color: '#3D5A80',
                  fontSize: '1.1vw',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  paddingBottom: '1vh',
                }}
              >
                Medium
              </div>
              <div
                style={{
                  width: '10vw',
                  textAlign: 'center',
                  color: '#3D5A80',
                  fontSize: '1.1vw',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  paddingBottom: '1vh',
                }}
              >
                High
              </div>
            </div>
            <div
              style={{
                color: '#999999',
                fontSize: '1vw',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                textAlign: 'center',
                marginLeft: '0',
                marginBottom: '0.5vh',
              }}
            >
              ← Urgency
            </div>
            <div style={{ display: 'flex', gap: '0', alignItems: 'center', marginBottom: '0.5vh' }}>
              <div
                style={{
                  width: '8vw',
                  color: '#3D5A80',
                  fontSize: '1.1vw',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  textAlign: 'right',
                  paddingRight: '1vw',
                }}
              >
                Low
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#D4EDDA',
                  border: '1px solid #C3E6CB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#155724',
                  fontSize: '1.3vw',
                  fontWeight: 600,
                }}
              >
                low
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#D4EDDA',
                  border: '1px solid #C3E6CB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#155724',
                  fontSize: '1.3vw',
                  fontWeight: 600,
                }}
              >
                low
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#FFF3CD',
                  border: '1px solid #FFEEBA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#856404',
                  fontSize: '1.3vw',
                  fontWeight: 600,
                }}
              >
                medium
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0', alignItems: 'center', marginBottom: '0.5vh' }}>
              <div
                style={{
                  width: '8vw',
                  color: '#3D5A80',
                  fontSize: '1.1vw',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  textAlign: 'right',
                  paddingRight: '1vw',
                }}
              >
                Medium
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#D4EDDA',
                  border: '1px solid #C3E6CB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#155724',
                  fontSize: '1.3vw',
                  fontWeight: 600,
                }}
              >
                low
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#FFF3CD',
                  border: '1px solid #FFEEBA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#856404',
                  fontSize: '1.3vw',
                  fontWeight: 600,
                }}
              >
                medium
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#F8D7DA',
                  border: '1px solid #F5C6CB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#721C24',
                  fontSize: '1.3vw',
                  fontWeight: 600,
                }}
              >
                high
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0', alignItems: 'center' }}>
              <div
                style={{
                  width: '8vw',
                  color: '#3D5A80',
                  fontSize: '1.1vw',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  textAlign: 'right',
                  paddingRight: '1vw',
                }}
              >
                High
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#FFF3CD',
                  border: '1px solid #FFEEBA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#856404',
                  fontSize: '1.3vw',
                  fontWeight: 600,
                }}
              >
                medium
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#F8D7DA',
                  border: '1px solid #F5C6CB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#721C24',
                  fontSize: '1.3vw',
                  fontWeight: 600,
                }}
              >
                high
              </div>
              <div
                style={{
                  width: '10vw',
                  height: '7vh',
                  backgroundColor: '#721C24',
                  border: '1px solid #721C24',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                  fontSize: '1.3vw',
                  fontWeight: 700,
                }}
              >
                critical
              </div>
            </div>
            <div
              style={{
                color: '#999999',
                fontSize: '1vw',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginTop: '1vh',
                marginLeft: '8vw',
              }}
            >
              ↑ Impact
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{ borderLeft: '3px solid #3D5A80', paddingLeft: '2vw', marginBottom: '3vh' }}
            >
              <div
                style={{
                  color: '#111111',
                  fontSize: '1.5vw',
                  fontWeight: 600,
                  marginBottom: '0.5vh',
                }}
              >
                Configurable Per Scope
              </div>
              <div style={{ color: '#666666', fontSize: '1.3vw', lineHeight: 1.6 }}>
                Each cell can be overridden at circuit, site, customer, or global level. Most
                specific scope wins. Stored in escalation_matrix_overrides.
              </div>
            </div>
            <div
              style={{ borderLeft: '3px solid #98C1D9', paddingLeft: '2vw', marginBottom: '3vh' }}
            >
              <div
                style={{
                  color: '#111111',
                  fontSize: '1.5vw',
                  fontWeight: 600,
                  marginBottom: '0.5vh',
                }}
              >
                UI: EscalationMatrixEditor
              </div>
              <div style={{ color: '#666666', fontSize: '1.3vw', lineHeight: 1.6 }}>
                3×3 grid editor on Admin, Customer detail, Site detail, Service detail pages.
                Override cells highlighted with ring + default label.
              </div>
            </div>
            <div style={{ borderLeft: '3px solid #EE6C4D', paddingLeft: '2vw' }}>
              <div
                style={{
                  color: '#111111',
                  fontSize: '1.5vw',
                  fontWeight: 600,
                  marginBottom: '0.5vh',
                }}
              >
                Ticket Creation
              </div>
              <div style={{ color: '#666666', fontSize: '1.3vw', lineHeight: 1.6 }}>
                Severity auto-derived on ticket create by resolving the matrix for that
                circuit/site/customer. ruleDescription logged per notification.
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
        10
      </div>
    </div>
  );
}

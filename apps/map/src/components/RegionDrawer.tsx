import type { Region, CrisisType } from '../types/region';

const crisisColors: Record<CrisisType, string> = {
  conflict: '#ef4444',
  famine: '#f97316',
  displacement: '#3b82f6',
  disaster: '#a855f7',
};

function severityColor(score: number): string {
  if (score <= 0.33) return '#fde047';
  if (score <= 0.66) return '#fb923c';
  return '#dc2626';
}

type RegionDrawerProps = {
  region: Region | null;
  onClose: () => void;
};

export default function RegionDrawer({ region, onClose }: RegionDrawerProps) {
  const isOpen = region !== null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '400px',
        height: '100vh',
        background: '#0a0a0a',
        borderLeft: '1px solid rgba(255,255,255,0.08)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: isOpen ? '-8px 0 32px rgba(0,0,0,0.5)' : 'none',
      }}
    >
      {region && (
        <>
          {/* Close button */}
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '20px',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
            }}
          >
            ×
          </button>

          {/* Content */}
          <div
            style={{
              padding: '32px 24px 24px',
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            {/* Region name */}
            <h2
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#fff',
                margin: 0,
                paddingRight: '40px',
                lineHeight: 1.3,
              }}
            >
              {region.name}
            </h2>

            {/* Crisis type badge */}
            <div>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: '999px',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#fff',
                  background: crisisColors[region.crisis_type],
                }}
              >
                {region.crisis_type}
              </span>
            </div>

            {/* Severity bar */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.5)',
                    fontWeight: 500,
                  }}
                >
                  Severity
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: severityColor(region.severity_score),
                  }}
                >
                  {region.severity_score.toFixed(2)}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '6px',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${region.severity_score * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, #fde047, #fb923c, ${severityColor(region.severity_score)})`,
                    borderRadius: '3px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>

            {/* Summary */}
            {region.summary && (
              <p
                style={{
                  fontSize: '14px',
                  lineHeight: 1.7,
                  color: 'rgba(255,255,255,0.7)',
                  margin: 0,
                }}
              >
                {region.summary}
              </p>
            )}

            {/* Divider */}
            <div
              style={{
                width: '100%',
                height: '1px',
                background: 'rgba(255,255,255,0.08)',
              }}
            />

            {/* Pool balance placeholder */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.4)',
                    fontWeight: 500,
                    marginBottom: '4px',
                  }}
                >
                  Pool Balance
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  0 <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>USDC</span>
                </div>
              </div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(59,130,246,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                💰
              </div>
            </div>
          </div>

          {/* Donate button */}
          <div style={{ padding: '16px 24px 24px' }}>
            <button
              onClick={() => console.log('donate clicked', region.region_id)}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 700,
                color: '#fff',
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'transform 0.15s, box-shadow 0.15s',
                boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
              }}
              onMouseEnter={(e) => {
                const btn = e.target as HTMLButtonElement;
                btn.style.transform = 'translateY(-1px)';
                btn.style.boxShadow = '0 6px 24px rgba(37,99,235,0.45)';
              }}
              onMouseLeave={(e) => {
                const btn = e.target as HTMLButtonElement;
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 4px 16px rgba(37,99,235,0.3)';
              }}
            >
              Donate
            </button>
          </div>
        </>
      )}
    </div>
  );
}

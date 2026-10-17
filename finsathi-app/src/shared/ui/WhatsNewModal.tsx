import { useProfileStore } from '../hooks/useProfileStore';
import { useWidgetStore } from '../widgets/useWidgetStore';
import { LATEST_RELEASE, type ReleaseItem } from '../lib/versioning';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhatsNewModal({ isOpen, onClose }: WhatsNewModalProps) {
  const { getActiveProfile, markVersionSeen } = useProfileStore();
  const { widgets, enableWidgetType } = useWidgetStore();
  const activeProfile = getActiveProfile();

  if (!isOpen) return null;

  const handleDismiss = () => {
    markVersionSeen(activeProfile.id, LATEST_RELEASE.version);
    onClose();
  };

  const handleEnableFeature = (item: ReleaseItem) => {
    if (item.widgetType) {
      enableWidgetType(item.widgetType, true);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '650px',
          maxHeight: '88vh',
          overflowY: 'auto',
          backgroundColor: '#0a0a0a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '4px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.8), 0 0 30px rgba(0, 255, 65, 0.1)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: 'var(--primary-container, #00ff41)',
                  boxShadow: '0 0 8px #00ff41',
                }}
              />
              <span style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--primary-container, #00ff41)', letterSpacing: '0.1em' }}>
                SOFTWARE UPDATE // VERSION {LATEST_RELEASE.version}
              </span>
            </div>
            <h2 style={{ margin: '6px 0 2px 0', fontSize: '18px', fontFamily: 'Space Grotesk, sans-serif', color: '#fff', fontWeight: 700 }}>
              {LATEST_RELEASE.title}
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
              Released {LATEST_RELEASE.date} • Enable new capabilities with one tap or via Local AI chat
            </p>
          </div>

          <button
            onClick={handleDismiss}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Feature List */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {LATEST_RELEASE.items.map((item) => {
            const isWidget = !!item.widgetType;
            const widgetInst = isWidget ? widgets.find((w) => w.type === item.widgetType) : null;
            const isEnabled = widgetInst ? widgetInst.enabled : false;

            return (
              <div
                key={item.id}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '3px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '9px',
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: '2px',
                        background: 'rgba(0, 255, 65, 0.1)',
                        color: 'var(--primary-container, #00ff41)',
                        border: '1px solid rgba(0, 255, 65, 0.2)',
                      }}
                    >
                      {item.badge}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#fff', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {item.title}
                    </span>
                  </div>

                  {isWidget && (
                    <div>
                      {isEnabled ? (
                        <span
                          style={{
                            fontSize: '10px',
                            fontFamily: 'monospace',
                            color: '#00ff41',
                            background: 'rgba(0, 255, 65, 0.08)',
                            padding: '3px 8px',
                            borderRadius: '2px',
                            border: '1px solid rgba(0, 255, 65, 0.2)',
                          }}
                        >
                          ACTIVE ON DASHBOARD ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => handleEnableFeature(item)}
                          style={{
                            background: 'var(--primary-container, #00ff41)',
                            color: '#000',
                            border: 'none',
                            padding: '4px 10px',
                            fontFamily: 'monospace',
                            fontSize: '10px',
                            fontWeight: 700,
                            borderRadius: '2px',
                            cursor: 'pointer',
                          }}
                        >
                          + {item.actionLabel || 'ENABLE'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)' }}>
            Available in Settings &gt; Workflow &gt; Feature Catalog
          </span>
          <button
            onClick={handleDismiss}
            style={{
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '6px 14px',
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              borderRadius: '2px',
            }}
          >
            DISMISS / GOT IT
          </button>
        </div>
      </div>
    </div>
  );
}

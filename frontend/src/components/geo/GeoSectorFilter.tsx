import React from 'react';

const SECTOR_COLORS: Record<string, string> = {
    IT: '#8b5cf6',
    Banking: '#3b82f6',
    Pharma: '#ef4444',
    Auto: '#f59e0b',
    Energy: '#10b981',
    Metals: '#6b7280',
    FMCG: '#ec4899',
    Infrastructure: '#14b8a6',
    Consumer: '#f97316',
    Telecom: '#06b6d4',
};

interface Props {
    activeSectors: string[];
    onToggle: (sector: string) => void;
}

const GeoSectorFilter: React.FC<Props> = ({ activeSectors, onToggle }) => {
    const sectors = Object.keys(SECTOR_COLORS);

    return (
        <div
            className="neural-hud custom-scrollbar"
            style={{
                position: 'absolute',
                top: 90,
                left: 10,
                zIndex: 1000,
                borderRadius: 12,
                padding: '20px',
                minWidth: 180,
                maxHeight: 'calc(100vh - 120px)',
                overflowY: 'auto',
            }}
        >
            <div
                style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 11,
                    color: '#00e5ff',
                    letterSpacing: 3,
                    marginBottom: 16,
                    textTransform: 'uppercase',
                    opacity: 0.8,
                }}
            >
                // SECTOR LAYERS
            </div>

            {sectors.map((sector) => {
                const isActive = activeSectors.includes(sector);
                return (
                    <div
                        key={sector}
                        onClick={() => onToggle(sector)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '6px 4px',
                            cursor: 'pointer',
                            borderRadius: 8,
                            transition: 'background 0.2s',
                            opacity: isActive ? 1 : 0.4,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                        <div
                            style={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                background: SECTOR_COLORS[sector],
                                boxShadow: isActive
                                    ? `0 0 8px ${SECTOR_COLORS[sector]}80`
                                    : 'none',
                                transition: 'box-shadow 0.3s',
                            }}
                        />
                        <span
                            style={{
                                fontSize: 13,
                                fontFamily: "'Rajdhani', sans-serif",
                                fontWeight: 600,
                                color: isActive ? '#e2e8f0' : '#475569',
                            }}
                        >
                            {sector}
                        </span>
                    </div>
                );
            })}

            <div
                style={{
                    marginTop: 14,
                    paddingTop: 10,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    gap: 8,
                }}
            >
                <button
                    onClick={() => sectors.forEach((s) => { if (!activeSectors.includes(s)) onToggle(s); })}
                    style={{
                        flex: 1,
                        fontSize: 10,
                        fontFamily: "'Share Tech Mono', monospace",
                        color: '#00e5ff',
                        background: 'rgba(0, 210, 255, 0.12)',
                        border: '1px solid rgba(0, 210, 255, 0.3)',
                        borderRadius: 6,
                        padding: '6px 0',
                        cursor: 'pointer',
                        fontWeight: 700,
                        letterSpacing: 1,
                    }}
                >
                    ACTIVATE ALL
                </button>
                <button
                    onClick={() => sectors.forEach((s) => { if (activeSectors.includes(s)) onToggle(s); })}
                    style={{
                        flex: 1,
                        fontSize: 10,
                        fontFamily: "'Share Tech Mono', monospace",
                        color: '#94a3b8',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 6,
                        padding: '6px 0',
                        cursor: 'pointer',
                        fontWeight: 700,
                        letterSpacing: 1,
                    }}
                >
                    CLEAR
                </button>
            </div>
        </div>
    );
};

export default GeoSectorFilter;
export { SECTOR_COLORS };

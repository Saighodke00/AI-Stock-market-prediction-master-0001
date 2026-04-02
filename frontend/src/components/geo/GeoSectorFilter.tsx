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
            style={{
                position: 'absolute',
                top: 80,
                left: 16,
                zIndex: 1000,
                background: 'rgba(6, 11, 20, 0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 14,
                padding: '16px 18px',
                minWidth: 170,
            }}
        >
            <div
                style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: 10,
                    color: '#5a75a0',
                    letterSpacing: 2,
                    marginBottom: 12,
                    textTransform: 'uppercase',
                }}
            >
                Sector Layers
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
                        background: 'rgba(0, 229, 255, 0.08)',
                        border: '1px solid rgba(0, 229, 255, 0.2)',
                        borderRadius: 6,
                        padding: '5px 0',
                        cursor: 'pointer',
                    }}
                >
                    ALL
                </button>
                <button
                    onClick={() => sectors.forEach((s) => { if (activeSectors.includes(s)) onToggle(s); })}
                    style={{
                        flex: 1,
                        fontSize: 10,
                        fontFamily: "'Share Tech Mono', monospace",
                        color: '#94a3b8',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 6,
                        padding: '5px 0',
                        cursor: 'pointer',
                    }}
                >
                    NONE
                </button>
            </div>
        </div>
    );
};

export default GeoSectorFilter;
export { SECTOR_COLORS };

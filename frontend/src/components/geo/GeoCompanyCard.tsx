import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface CompanyData {
    id: number;
    name: string;
    ticker: string;
    sector: string;
    city: string;
    state: string;
    description: string;
    stock?: {
        current_price: number;
        change_pct: number;
        market_cap: number;
        volume: number;
        is_up: boolean;
        color: string;
    };
    news?: { title: string; url: string; publisher: string }[];
}

interface Props {
    companyId: number;
    onClose: () => void;
}

const API = import.meta.env.VITE_API_URL || '';

const GeoCompanyCard: React.FC<Props> = ({ companyId, onClose }) => {
    const [data, setData] = useState<CompanyData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        axios
            .get(`${API}/api/geo/company/${companyId}`)
            .then((r) => setData(r.data))
            .catch(() => setData(null))
            .finally(() => setLoading(false));

        // Live refresh every 30s
        const iv = setInterval(() => {
            axios.get(`${API}/api/geo/company/${companyId}`).then((r) => setData(r.data));
        }, 30000);
        return () => clearInterval(iv);
    }, [companyId]);

    const isUp = data?.stock?.change_pct != null ? data.stock.change_pct >= 0 : true;

    const sectorColor: Record<string, string> = {
        IT: '#8b5cf6', Banking: '#3b82f6', Pharma: '#ef4444', Auto: '#f59e0b',
        Energy: '#10b981', Metals: '#6b7280', FMCG: '#ec4899',
        Infrastructure: '#14b8a6', Consumer: '#f97316', Telecom: '#06b6d4',
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: 60,
                right: 16,
                bottom: 16,
                zIndex: 1000,
                width: 340,
                background: 'rgba(6, 11, 20, 0.96)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
            }}
            className="custom-scrollbar"
        >
            {/* Header */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
            >
                <span
                    style={{
                        fontFamily: "'Orbitron', sans-serif",
                        fontSize: 11,
                        color: '#00e5ff',
                        letterSpacing: 1.5,
                    }}
                >
                    COMPANY INTEL
                </span>
                <button
                    onClick={onClose}
                    style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: 'none',
                        borderRadius: 8,
                        color: '#94a3b8',
                        fontSize: 16,
                        cursor: 'pointer',
                        padding: '4px 10px',
                        lineHeight: 1,
                    }}
                >
                    ✕
                </button>
            </div>

            {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#5a75a0', fontSize: 13 }}>
                    Loading company intel...
                </div>
            ) : !data ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#ff1744' }}>
                    Failed to load data
                </div>
            ) : (
                <div style={{ padding: '16px 18px' }}>
                    {/* Company Info */}
                    <div style={{ marginBottom: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <div
                                style={{
                                    width: 42,
                                    height: 42,
                                    borderRadius: 12,
                                    background: 'rgba(255,255,255,0.04)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 22,
                                }}
                            >
                                🏢
                            </div>
                            <div>
                                <div
                                    style={{
                                        fontFamily: "'Rajdhani', sans-serif",
                                        fontWeight: 700,
                                        fontSize: 17,
                                        color: '#fff',
                                        lineHeight: 1.2,
                                    }}
                                >
                                    {data.name}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            padding: '2px 10px',
                                            borderRadius: 50,
                                            background: `${sectorColor[data.sector] || '#6b7280'}18`,
                                            color: sectorColor[data.sector] || '#6b7280',
                                            border: `1px solid ${sectorColor[data.sector] || '#6b7280'}30`,
                                            fontWeight: 600,
                                        }}
                                    >
                                        {data.sector}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: 10,
                                            color: '#5a75a0',
                                            fontFamily: "'Share Tech Mono', monospace",
                                        }}
                                    >
                                        📍 {data.city}, {data.state}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, margin: '10px 0 0' }}>
                            {data.description}
                        </p>
                    </div>

                    {/* Stock Data */}
                    {data.stock && (
                        <div style={{ marginBottom: 18 }}>
                            <div
                                style={{
                                    fontFamily: "'Share Tech Mono', monospace",
                                    fontSize: 10,
                                    color: '#5a75a0',
                                    letterSpacing: 1.5,
                                    marginBottom: 8,
                                }}
                            >
                                REAL-TIME STOCK DATA
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                                <div
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                    }}
                                >
                                    <div style={{ fontSize: 10, color: '#5a75a0', marginBottom: 4 }}>Price</div>
                                    <div
                                        style={{
                                            fontFamily: "'Orbitron', sans-serif",
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: '#fff',
                                        }}
                                    >
                                        ₹{data.stock.current_price?.toLocaleString()}
                                    </div>
                                </div>
                                <div
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                    }}
                                >
                                    <div style={{ fontSize: 10, color: '#5a75a0', marginBottom: 4 }}>Change</div>
                                    <div
                                        style={{
                                            fontFamily: "'Orbitron', sans-serif",
                                            fontSize: 15,
                                            fontWeight: 700,
                                            color: isUp ? '#00e676' : '#ff1744',
                                        }}
                                    >
                                        {isUp ? '▲' : '▼'} {Math.abs(data.stock.change_pct ?? 0).toFixed(2)}%
                                    </div>
                                </div>
                                <div
                                    style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                    }}
                                >
                                    <div style={{ fontSize: 10, color: '#5a75a0', marginBottom: 4 }}>Volume</div>
                                    <div
                                        style={{
                                            fontFamily: "'Orbitron', sans-serif",
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: '#fff',
                                        }}
                                    >
                                        {data.stock.volume?.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            {/* Market Cap */}
                            {data.stock.market_cap > 0 && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <span style={{ fontSize: 10, color: '#5a75a0' }}>Market Cap</span>
                                    <span
                                        style={{
                                            fontFamily: "'Share Tech Mono', monospace",
                                            fontSize: 12,
                                            color: '#e2e8f0',
                                        }}
                                    >
                                        ₹{(data.stock.market_cap / 1e7).toFixed(0)} Cr
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* News */}
                    {data.news && data.news.length > 0 && (
                        <div>
                            <div
                                style={{
                                    fontFamily: "'Share Tech Mono', monospace",
                                    fontSize: 10,
                                    color: '#5a75a0',
                                    letterSpacing: 1.5,
                                    marginBottom: 8,
                                }}
                            >
                                LATEST NEWS
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {data.news.map((item, i) => (
                                    <a
                                        key={i}
                                        href={item.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            display: 'block',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: 10,
                                            padding: '10px 12px',
                                            textDecoration: 'none',
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={(e) =>
                                            (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')
                                        }
                                        onMouseLeave={(e) =>
                                            (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')
                                        }
                                    >
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: '#e2e8f0',
                                                lineHeight: 1.5,
                                                marginBottom: 4,
                                            }}
                                        >
                                            {item.title}
                                        </div>
                                        <div style={{ fontSize: 10, color: '#5a75a0' }}>{item.publisher}</div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* NSE Link */}
                    <a
                        href={`https://www.nseindia.com/get-quotes/equity?symbol=${data.ticker?.replace('.NS', '')}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                            display: 'block',
                            textAlign: 'center',
                            marginTop: 16,
                            padding: '10px 0',
                            borderRadius: 10,
                            border: '1px solid rgba(0, 229, 255, 0.2)',
                            color: '#00e5ff',
                            fontSize: 11,
                            fontFamily: "'Share Tech Mono', monospace",
                            textDecoration: 'none',
                            transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.background = 'rgba(0, 229, 255, 0.08)')
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.background = 'transparent')
                        }
                    >
                        View on NSE India →
                    </a>
                </div>
            )}
        </div>
    );
};

export default GeoCompanyCard;

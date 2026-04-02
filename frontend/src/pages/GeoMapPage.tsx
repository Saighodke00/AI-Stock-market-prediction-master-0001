import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import GeoSectorFilter, { SECTOR_COLORS } from '../components/geo/GeoSectorFilter';
import GeoCompanyCard from '../components/geo/GeoCompanyCard';

const API = import.meta.env.VITE_API_URL || '';

/* ── Sector → marker color ─────────────────────────────────────────────── */
const createMarkerIcon = (sector: string, isUp: boolean | null) => {
    const base = SECTOR_COLORS[sector] || '#6b7280';
    const ring = isUp === null ? 'rgba(255,255,255,0.3)' : isUp ? '#00e676' : '#ff1744';

    return L.divIcon({
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        html: `
            <div style="
                width:22px; height:22px; border-radius:50%;
                background:${base}; border:3px solid ${ring};
                box-shadow: 0 0 10px ${base}80, 0 0 20px ${base}40;
                cursor:pointer; transition: transform 0.2s;
            " onmouseenter="this.style.transform='scale(1.3)'"
               onmouseleave="this.style.transform='scale(1)'" />
        `,
    });
};

const createClusterIcon = (count: number) => {
    const size = count < 10 ? 36 : count < 25 ? 44 : 52;
    const bg = count < 10 ? '#00d2ff' : count < 25 ? '#0080ff' : '#6600ff';
    return L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `
            <div style="
                width:${size}px; height:${size}px; border-radius:50%;
                background:${bg}; opacity:0.85;
                display:flex; align-items:center; justify-content:center;
                color:#fff; font-weight:700; font-size:13px;
                font-family:'Orbitron',sans-serif;
                box-shadow: 0 0 14px ${bg}60;
                border: 2px solid rgba(255,255,255,0.2);
            ">${count}</div>
        `,
    });
};

/* ── page ──────────────────────────────────────────────────────────────── */
interface GeoFeature {
    type: string;
    geometry: { type: string; coordinates: [number, number] };
    properties: {
        id: number;
        name: string;
        ticker: string;
        sector: string;
        city: string;
        state: string;
        description: string;
    };
}

const ALL_SECTORS = Object.keys(SECTOR_COLORS);

export const GeoMapPage: React.FC = () => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);

    const [features, setFeatures] = useState<GeoFeature[]>([]);
    const [activeSectors, setActiveSectors] = useState<string[]>([...ALL_SECTORS]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const [stockColors, setStockColors] = useState<Record<string, boolean>>({});

    /* ── 1. Fetch GeoJSON ─────────────────────────────────────────────── */
    useEffect(() => {
        axios
            .get(`${API}/api/geo/companies`)
            .then((r) => setFeatures(r.data.features || []))
            .catch(() => {});
    }, []);

    /* ── 2. Init map once ─────────────────────────────────────────────── */
    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [22.0, 78.5],
            zoom: 5,
            minZoom: 4,
            maxZoom: 15,
            zoomControl: false,
        });

        /* CartoDB Dark Matter tiles */
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            subdomains: 'abcd',
            maxZoom: 19,
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    /* ── 3. Render markers when features or filters change ────────────── */
    useEffect(() => {
        if (!markersLayerRef.current) return;
        markersLayerRef.current.clearLayers();

        const visible = features.filter((f) => activeSectors.includes(f.properties.sector));

        /* simple clustering: group by city */
        const cityGroups: Record<string, GeoFeature[]> = {};
        visible.forEach((f) => {
            const key = `${f.geometry.coordinates[1].toFixed(1)}_${f.geometry.coordinates[0].toFixed(1)}`;
            if (!cityGroups[key]) cityGroups[key] = [];
            cityGroups[key].push(f);
        });

        Object.values(cityGroups).forEach((group) => {
            if (group.length >= 4 && mapRef.current && mapRef.current.getZoom() < 8) {
                /* cluster marker */
                const avgLat = group.reduce((s, f) => s + f.geometry.coordinates[1], 0) / group.length;
                const avgLng = group.reduce((s, f) => s + f.geometry.coordinates[0], 0) / group.length;
                const marker = L.marker([avgLat, avgLng], {
                    icon: createClusterIcon(group.length),
                });

                const cities = [...new Set(group.map((f) => f.properties.city))];
                marker.bindTooltip(
                    `<div style="background:#0a0f1a;border:1px solid #1a2b4d;border-radius:8px;padding:8px 12px;font-family:'Rajdhani',sans-serif;">
                        <div style="color:#00e5ff;font-weight:700;font-size:13px;">${cities.join(', ')}</div>
                        <div style="color:#5a75a0;font-size:11px;margin-top:2px;">${group.length} companies</div>
                    </div>`,
                    { direction: 'top', offset: [0, -10], className: 'geo-tooltip' }
                );

                marker.on('click', () => {
                    mapRef.current?.setView([avgLat, avgLng], 10, { animate: true });
                });

                markersLayerRef.current!.addLayer(marker);
            } else {
                /* individual markers */
                group.forEach((f, idx) => {
                    const [lng, lat] = f.geometry.coordinates;
                    const offset = idx * 0.004; // slight offset so overlapping markers separate
                    const isUp = stockColors[f.properties.ticker] ?? null;
                    const marker = L.marker([lat + offset, lng + offset], {
                        icon: createMarkerIcon(f.properties.sector, isUp),
                    });

                    marker.bindTooltip(
                        `<div style="background:#0a0f1a;border:1px solid #1a2b4d;border-radius:8px;padding:8px 12px;font-family:'Rajdhani',sans-serif;min-width:120px;">
                            <div style="color:#fff;font-weight:700;font-size:13px;">${f.properties.name}</div>
                            <div style="display:flex;gap:8px;margin-top:4px;align-items:center;">
                                <span style="font-size:10px;padding:1px 8px;border-radius:50px;background:${SECTOR_COLORS[f.properties.sector]}18;color:${SECTOR_COLORS[f.properties.sector]};border:1px solid ${SECTOR_COLORS[f.properties.sector]}30;">${f.properties.sector}</span>
                                <span style="color:#5a75a0;font-size:10px;">📍 ${f.properties.city}</span>
                            </div>
                            <div style="color:#00e5ff;font-size:10px;margin-top:4px;font-family:'Share Tech Mono',monospace;">${f.properties.ticker}</div>
                        </div>`,
                        { direction: 'top', offset: [0, -10], className: 'geo-tooltip' }
                    );

                    marker.on('click', () => setSelectedCompanyId(f.properties.id));
                    markersLayerRef.current!.addLayer(marker);
                });
            }
        });
    }, [features, activeSectors, stockColors]);

    /* ── 4. Re-render on zoom ─────────────────────────────────────────── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const handler = () => {
            // Trigger a re-render by flipping a dummy state
            setActiveSectors((prev) => [...prev]);
        };
        map.on('zoomend', handler);
        return () => { map.off('zoomend', handler); };
    }, []);

    /* ── 5. Fetch live prices periodically ────────────────────────────── */
    useEffect(() => {
        if (features.length === 0) return;

        const fetchPrices = async () => {
            const map: Record<string, boolean> = {};
            // Sample 15 tickers to avoid overwhelming the API
            const sample = features.slice(0, 15);
            await Promise.allSettled(
                sample.map(async (f) => {
                    try {
                        const r = await axios.get(`${API}/api/geo/stock/${f.properties.ticker}`);
                        map[f.properties.ticker] = r.data.is_up;
                    } catch { /* skip */ }
                })
            );
            setStockColors((prev) => ({ ...prev, ...map }));
        };

        fetchPrices();
        const iv = setInterval(fetchPrices, 60000);
        return () => clearInterval(iv);
    }, [features]);

    /* ── toggle sector filter ─────────────────────────────────────────── */
    const handleToggle = (sector: string) => {
        setActiveSectors((prev) =>
            prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
        );
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Leaflet tooltip style override */}
            <style>{`
                .geo-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
                .geo-tooltip::before {
                    display: none !important;
                }
                .leaflet-control-zoom a {
                    background: #0a0f1a !important;
                    color: #00e5ff !important;
                    border-color: #1a2b4d !important;
                }
                .leaflet-control-zoom a:hover {
                    background: #1a2b4d !important;
                }
            `}</style>

            {/* Top bar */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    background: 'rgba(6, 11, 20, 0.88)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 20px',
                    gap: 18,
                }}
            >
                <span style={{ fontSize: 22 }}>🗺️</span>
                <div>
                    <div
                        style={{
                            fontFamily: "'Orbitron', sans-serif",
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#fff',
                            letterSpacing: 2,
                        }}
                    >
                        GEO STOCK MAP
                    </div>
                    <div
                        style={{
                            fontFamily: "'Share Tech Mono', monospace",
                            fontSize: 10,
                            color: '#5a75a0',
                            letterSpacing: 1,
                        }}
                    >
                        INDIAN MARKET · {features.length} COMPANIES · LIVE
                    </div>
                </div>

                <div style={{ flex: 1 }} />

                {/* Quick stats */}
                <div style={{ display: 'flex', gap: 20 }}>
                    {['IT', 'Banking', 'Pharma', 'Energy'].map((s) => (
                        <div
                            key={s}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 11,
                                fontFamily: "'Share Tech Mono', monospace",
                                color: '#94a3b8',
                            }}
                        >
                            <div
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    background: SECTOR_COLORS[s],
                                }}
                            />
                            {features.filter((f) => f.properties.sector === s).length} {s}
                        </div>
                    ))}
                </div>
            </div>

            {/* Map */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

            {/* Sector Filter */}
            <GeoSectorFilter activeSectors={activeSectors} onToggle={handleToggle} />

            {/* Company Card */}
            {selectedCompanyId && (
                <GeoCompanyCard
                    companyId={selectedCompanyId}
                    onClose={() => setSelectedCompanyId(null)}
                />
            )}
        </div>
    );
};

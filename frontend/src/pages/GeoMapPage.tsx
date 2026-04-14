import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Map as MapIcon, Layers, Info, Activity, Globe, Target, 
  BarChart3, RefreshCw, ChevronRight, X, TrendingUp 
} from 'lucide-react';

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
                cursor:pointer; transition: transform 0.2s, box-shadow 0.3s;
            " class="animate-pulse-radar active-node"
               onmouseenter="this.style.transform='scale(1.4)'; this.style.boxShadow='0 0 30px ${base}';"
               onmouseleave="this.style.transform='scale(1)'; this.style.boxShadow='0 0 10px ${base}80';" />
        `,
    });
};

const createClusterIcon = (count: number) => {
    const size = count < 10 ? 36 : count < 25 ? 46 : 56;
    const bg = count < 10 ? '#00d2ff' : count < 25 ? '#3b82f6' : '#8b5cf6';
    return L.divIcon({
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `
            <div class="neural-cluster" style="
                width:${size}px; height:${size}px; border-radius:50%;
                background:${bg}; opacity:0.9;
                display:flex; flex-direction:column; align-items:center; justify-content:center;
                color:#fff; font-weight:900;
                font-family:inherit;
                box-shadow: 0 0 20px ${bg}80;
                border: 2px solid rgba(255,255,255,0.4);
            ">
                <span style="font-size:14px; line-height:1;">${count}</span>
                <span style="font-size:6px; opacity:0.6; text-transform:uppercase; letter-spacing:1px; margin-top:2px;">Nodes</span>
            </div>
        `,
    });
};

/* ── Types ───────────────────────────────────────────────────────────── */
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
    const [loading, setLoading] = useState(true);

    /* ── Intelligence derived from features ──────────────────────────── */
    const sectorStats = useMemo(() => {
        const stats: Record<string, number> = {};
        features.forEach((f) => {
            const s = f.properties.sector;
            stats[s] = (stats[s] || 0) + 1;
        });
        return stats;
    }, [features]);

    const activeDomainCount = useMemo(() => {
        return features.filter(f => activeSectors.includes(f.properties.sector)).length;
    }, [features, activeSectors]);

    /* ── 1. Fetch GeoJSON ────────────────────────────────────────────── */
    useEffect(() => {
        setLoading(true);
        axios
            .get(`${API}/api/geo/companies?t=${Date.now()}`)
            .then((r) => setFeatures(r.data.features || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    /* ── 2. Init map ────────────────────────────────────────────────── */
    useEffect(() => {
        if (mapRef.current || !mapContainerRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [22.8, 79.5],
            zoom: 5,
            minZoom: 4,
            maxZoom: 16,
            zoomControl: false,
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© CARTO',
            subdomains: 'abcd',
            maxZoom: 20,
        }).addTo(map);

        L.control.zoom({ position: 'bottomright' }).addTo(map);
        mapRef.current = map;
        markersLayerRef.current = L.layerGroup().addTo(map);

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    /* ── 3. Render markers ──────────────────────────────────────────── */
    useEffect(() => {
        if (!markersLayerRef.current) return;
        markersLayerRef.current.clearLayers();

        const visible = features.filter((f) => activeSectors.includes(f.properties.sector));

        const cityGroups: Record<string, GeoFeature[]> = {};
        visible.forEach((f) => {
            const key = `${f.geometry.coordinates[1].toFixed(1)}_${f.geometry.coordinates[0].toFixed(1)}`;
            if (!cityGroups[key]) cityGroups[key] = [];
            cityGroups[key].push(f);
        });

        Object.values(cityGroups).forEach((group) => {
            if (group.length >= 4 && mapRef.current && mapRef.current.getZoom() < 8) {
                const avgLat = group.reduce((s, f) => s + f.geometry.coordinates[1], 0) / group.length;
                const avgLng = group.reduce((s, f) => s + f.geometry.coordinates[0], 0) / group.length;
                const marker = L.marker([avgLat, avgLng], { icon: createClusterIcon(group.length) });

                const cities = [...new Set(group.map((f) => f.properties.city))];
                marker.bindTooltip(
                    `<div class="glass-tooltip">
                        <div class="city-name">${cities.join(', ')}</div>
                        <div class="node-count">${group.length} Clusters Synced</div>
                    </div>`,
                    { direction: 'top', offset: [0, -10], className: 'neural-map-tooltip' }
                );

                marker.on('click', () => {
                    mapRef.current?.setView([avgLat, avgLng], 10, { animate: true });
                });

                markersLayerRef.current!.addLayer(marker);
            } else {
                group.forEach((f, idx) => {
                    const [lng, lat] = f.geometry.coordinates;
                    const offset = idx * 0.003;
                    const isUp = stockColors[f.properties.ticker] ?? null;
                    const marker = L.marker([lat + offset, lng + offset], {
                        icon: createMarkerIcon(f.properties.sector, isUp),
                    });

                    marker.bindTooltip(
                        `<div class="glass-tooltip mini">
                            <div class="company-name">${f.properties.name}</div>
                            <div class="tag-row">
                                <span class="sector-tag" style="color:${SECTOR_COLORS[f.properties.sector]}; border-color:${SECTOR_COLORS[f.properties.sector]}30; background:${SECTOR_COLORS[f.properties.sector]}10">${f.properties.sector}</span>
                                <span class="ticker-id">${f.properties.ticker}</span>
                            </div>
                        </div>`,
                        { direction: 'top', offset: [0, -10], className: 'neural-map-tooltip' }
                    );

                    marker.on('click', () => setSelectedCompanyId(f.properties.id));
                    markersLayerRef.current!.addLayer(marker);
                });
            }
        });
    }, [features, activeSectors, stockColors]);

    /* ── 4. Zoom handler ────────────────────────────────────────────── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        const handler = () => setActiveSectors((prev) => [...prev]);
        map.on('zoomend', handler);
        return () => { map.off('zoomend', handler); };
    }, []);

    /* ── 5. Market Refresh ──────────────────────────────────────────── */
    useEffect(() => {
        if (features.length === 0) return;
        const fetchPrices = async () => {
            const sample = features.filter(f => activeSectors.includes(f.properties.sector)).slice(0, 20);
            if (sample.length === 0) return;
            const tickers = sample.map(f => f.properties.ticker);
            try {
                const r = await axios.post(`${API}/api/geo/stocks/batch`, { tickers });
                if (r.data && !r.data.error) {
                    setStockColors((prev) => ({ ...prev, ...r.data }));
                }
            } catch (err) {
                console.error("Batch fetch failed", err);
            }
        };
        fetchPrices();
        const iv = setInterval(fetchPrices, 45000);
        return () => clearInterval(iv);
    }, [features, activeSectors]);

    const handleToggle = (sector: string) => {
        setActiveSectors((prev) =>
            prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
        );
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
            <style>{`
                .neural-map-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding:0 !important; }
                .neural-map-tooltip::before { display: none !important; }
                .glass-tooltip { 
                    background: rgba(10, 15, 26, 0.9) !important; 
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(0, 229, 255, 0.2) !important;
                    border-radius: 8px; padding: 6px 12px; min-width: 120px;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.4);
                }
                .glass-tooltip.mini { padding: 4px 10px; min-width: 100px; }
                .city-name, .company-name { color: #fff; font-family: inherit; font-weight: 800; font-size: 13px; text-transform: uppercase; }
                .node-count, .ticker-id { color: #00e5ff; font-family: inherit; font-size: 9px; margin-top: 1px; }
                .tag-row { display: flex; gap: 4px; margin-top: 4px; align-items: center; }
                .sector-tag { font-size: 7px; padding: 0.5px 5px; border-radius: 3px; border: 1px solid; font-weight: 900; }
                .leaflet-control-zoom { border: none !important; margin-right: 16px !important; margin-bottom: 16px !important; }
                .leaflet-control-zoom a { background: rgba(10,15,26,0.8) !important; color: #00e5ff !important; border: 1px solid rgba(0,229,255,0.2) !important; border-radius: 6px !important; margin-bottom: 3px !important; backdrop-filter: blur(4px); }
                .animate-pulse-radar { animation: pulse-shadow 2s infinite; }
                @keyframes pulse-shadow { 0% { box-shadow: 0 0 0 0px rgba(0, 229, 255, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(0, 229, 255, 0); } 100% { box-shadow: 0 0 0 0px rgba(0, 229, 255, 0); } }
                
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* Neural Intelligence Header */}
            <div
                className="neural-hud scanline-effect"
                style={{
                    position: 'absolute', top: 12, left: 12, right: 12, zIndex: 1000,
                    borderRadius: 12, display: 'flex', alignItems: 'center',
                    padding: '8px 20px', gap: 16, border: '1px solid rgba(255,255,255,0.05)',
                    background: 'rgba(6, 11, 20, 0.85)', backdropFilter: 'blur(10px)'
                }}
            >
                <div className="flex items-center gap-3 group">
                    <div className="w-9 h-9 rounded-xl bg-cyan/10 border border-cyan/20 flex items-center justify-center shadow-lg group-hover:border-cyan transition-all cursor-crosshair">
                        <Globe className="text-cyan animate-spin-slow" size={18} />
                    </div>
                    <div>
                        <div className="font-display font-black text-sm text-primary tracking-[0.15em] uppercase leading-none">
                            Geo_Intelligence <span className="text-muted italic font-data text-[10px] ml-1 select-none">v3.5</span>
                        </div>
                        <div className="font-data text-[8px] text-muted tracking-widest uppercase mt-1 flex items-center gap-1.5">
                            <Activity size={8} className="text-emerald" />
                            {features.length} Nodes &middot; <span className="text-cyan">{activeDomainCount} Visible</span>
                        </div>
                    </div>
                </div>

                <div className="hidden lg:flex flex-1 items-center justify-center gap-4 overflow-x-auto no-scrollbar mask-fade-edges">
                    {ALL_SECTORS.map((s) => (
                        <div key={s} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.01] border border-dim hover:border-mid transition-all shrink-0">
                            <div className="w-1 h-1 rounded-full" style={{ background: SECTOR_COLORS[s], boxShadow: `0 0 6px ${SECTOR_COLORS[s]}` }} />
                            <span className="text-[9px] font-black text-primary uppercase tracking-tight">{s}</span>
                            <span className="text-[9px] font-data font-bold text-muted">{sectorStats[s] || 0}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <div className="h-8 w-px bg-border-dim" />
                    <button onClick={() => window.location.reload()} className="p-2 rounded-lg bg-white/5 border border-dim text-muted hover:text-cyan transition-all">
                        <RefreshCw size={14} />
                    </button>
                    <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald/5 border border-emerald/10">
                        <div className="w-1 h-1 rounded-full bg-emerald animate-pulse" />
                        <span className="text-[8px] font-black text-emerald tracking-widest uppercase">Sync</span>
                    </div>
                </div>
            </div>

            {/* Main Interactive Map */}
            <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#020408' }} />

            {/* Command Sidebar: Sector Filter */}
            <GeoSectorFilter activeSectors={activeSectors} onToggle={handleToggle} />

            {/* Neural Intel Dossier: Company Card */}
            {selectedCompanyId && (
                <GeoCompanyCard
                    companyId={selectedCompanyId}
                    onClose={() => setSelectedCompanyId(null)}
                />
            )}

            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 bg-base/60 backdrop-blur-sm z-[2000] flex flex-col items-center justify-center gap-4">
                    <Activity className="text-cyan animate-pulse" size={48} />
                    <span className="text-xs font-black text-primary uppercase tracking-[0.4em] animate-pulse">Syncing Neural Nodes...</span>
                </div>
            )}
        </div>
    );
};

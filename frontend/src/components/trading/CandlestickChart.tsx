import React, { useEffect, useRef, useState } from 'react';
import {
    createChart,
    ColorType,
    LineStyle,
    IChartApi,
    CrosshairMode
} from 'lightweight-charts';
import { Monitor, BarChart3, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface OHLCVPoint {
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface ForecastPoint {
    time: string | number;
    p10: number;
    p50: number;
    p90: number;
}

interface CandlestickChartProps {
    ticker?: string;
    ohlcv?: OHLCVPoint[];
    forecast?: ForecastPoint[];
    action?: string;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({ 
    ticker, 
    ohlcv: initialOhlcv = [], 
    forecast: initialForecast = [], 
    action: initialAction = 'HOLD' 
}) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [legendData, setLegendData] = useState<OHLCVPoint | null>(null);
    
    const [internalData, setInternalData] = useState<{
        ohlcv: OHLCVPoint[],
        forecast: ForecastPoint[],
        action: string
    }>({
        ohlcv: initialOhlcv,
        forecast: initialForecast,
        action: initialAction
    });

    const [isFetching, setIsFetching] = useState(false);

    // Sync if props change
    useEffect(() => {
        if (initialOhlcv.length > 0) {
            setInternalData({
                ohlcv: initialOhlcv,
                forecast: initialForecast,
                action: initialAction
            });
        }
    }, [initialOhlcv, initialForecast, initialAction]);

    // Self-fetch if empty and ticker provided
    useEffect(() => {
        if (internalData.ohlcv.length === 0 && ticker) {
            const fetchData = async () => {
                setIsFetching(true);
                try {
                    const response = await fetch(`http://localhost:8000/api/signal/${ticker}`);
                    const data = await response.json();
                    
                    // Transformation logic to match OHLCVPoint and ForecastPoint
                    // Note: This expects the /api/signal response to contain chart data
                    // If it doesn't, we might need a different endpoint like /api/chart/{ticker}
                    if (data.ohlcv) {
                        setInternalData({
                            ohlcv: data.ohlcv,
                            forecast: data.forecast || [],
                            action: data.action || 'HOLD'
                        });
                    }
                } catch (error) {
                    console.error("Failed to self-fetch chart data", error);
                } finally {
                    setIsFetching(false);
                }
            };
            fetchData();
        }
    }, [ticker, internalData.ohlcv.length]);

    const { ohlcv, forecast, action } = internalData;

    useEffect(() => {
        if (!chartContainerRef.current || !ohlcv.length) return;

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#64748b',
                fontFamily: 'Inter, system-ui, sans-serif',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.03)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
            },
            crosshair: {
                mode: CrosshairMode.Normal,
                vertLine: {
                    color: '#6366f1',
                    width: 1,
                    style: LineStyle.Solid,
                    labelBackgroundColor: '#6366f1',
                },
                horzLine: {
                    color: '#6366f1',
                    width: 1,
                    style: LineStyle.Solid,
                    labelBackgroundColor: '#6366f1',
                },
            },
            timeScale: {
                borderColor: 'rgba(255, 255, 255, 0.05)',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: 'rgba(255, 255, 255, 0.05)',
            },
            width: chartContainerRef.current.clientWidth,
            height: 420,
            handleScroll: true,
            handleScale: true,
        });
        chartRef.current = chart;

        // 1. Candlestick Series
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#10b981',
            downColor: '#f43f5e',
            borderVisible: false,
            wickUpColor: '#10b981',
            wickDownColor: '#f43f5e',
        });

        const formattedOhlc = ohlcv.map(p => ({
            time: (isNaN(Number(p.time)) ? p.time : Number(p.time)) as any,
            open: p.open,
            high: p.high,
            low: p.low,
            close: p.close,
        })).sort((a, b) => (a.time > b.time ? 1 : -1));

        candlestickSeries.setData(formattedOhlc);

        // 2. Volume Series
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: { type: 'volume' },
            priceScaleId: '', // overlay
        });

        volumeSeries.priceScale().applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        const formattedVolume = ohlcv.map(p => ({
            time: (isNaN(Number(p.time)) ? p.time : Number(p.time)) as any,
            value: p.volume,
            color: p.close >= p.open ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
        })).sort((a, b) => (a.time > b.time ? 1 : -1));

        volumeSeries.setData(formattedVolume);

        // 3. Forecast Lines + Cone Shading
        if (forecast.length && formattedOhlc.length) {
            const lastHistorical = formattedOhlc[formattedOhlc.length - 1];

            // Start all forecast lines from last historical close for continuity
            const anchorTime = lastHistorical.time;
            const anchorClose = lastHistorical.close;

            const fmtForecast = forecast.map(f => ({
                t: (isNaN(Number(f.time)) ? f.time : Number(f.time)) as any,
                p10: f.p10,
                p50: f.p50,
                p90: f.p90,
            })).sort((a, b) => (a.t > b.t ? 1 : -1));

            // ── P90 top cone edge (bullish) — filled area downward ──
            const p90Series = chart.addAreaSeries({
                topColor:    'rgba(16, 185, 129, 0.1)',
                bottomColor: 'rgba(16, 185, 129, 0.0)',
                lineColor:   '#10b981',
                lineWidth:   1,
                lineStyle:   LineStyle.Dashed,
                crosshairMarkerVisible: false,
            });
            p90Series.setData([
                { time: anchorTime, value: anchorClose },
                ...fmtForecast.map(f => ({ time: f.t, value: f.p90 }))
            ]);

            // ── P50 median line ──
            const p50Series = chart.addLineSeries({
                color: '#6366f1',
                lineWidth: 2,
                lineStyle: LineStyle.Dashed,
                crosshairMarkerVisible: true,
            });
            p50Series.setData([
                { time: anchorTime, value: anchorClose },
                ...fmtForecast.map(f => ({ time: f.t, value: f.p50 }))
            ]);

            // ── P10 bottom cone edge (bearish) — filled area upward ──
            const p10Series = chart.addAreaSeries({
                topColor:    'rgba(244, 63, 94, 0.0)',
                bottomColor: 'rgba(244, 63, 94, 0.1)',
                lineColor:   '#f43f5e',
                lineWidth:   1,
                lineStyle:   LineStyle.Dashed,
                crosshairMarkerVisible: false,
                invertFilledArea: true,
            });
            p10Series.setData([
                { time: anchorTime, value: anchorClose },
                ...fmtForecast.map(f => ({ time: f.t, value: f.p10 }))
            ]);

            // ── NOW marker on the p50 line ──
            p50Series.createPriceLine({
                price: anchorClose,
                color: '#6366f1',
                lineWidth: 1,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: 'SIGNAL GENERATED',
            });
        }

        // 5. Tooltip/Legend Sync
        chart.subscribeCrosshairMove(param => {
            if (param.time && param.seriesData.get(candlestickSeries)) {
                const data = param.seriesData.get(candlestickSeries) as any;
                const volData = param.seriesData.get(volumeSeries) as any;
                setLegendData({
                    time: param.time as any,
                    open: data.open,
                    high: data.high,
                    low: data.low,
                    close: data.close,
                    volume: volData?.value || 0
                });
            } else {
                setLegendData(ohlcv[ohlcv.length - 1]);
            }
        });

        window.addEventListener('resize', handleResize);
        chart.timeScale().fitContent();

        return () => {
            window.removeEventListener('resize', handleResize);
            chart.remove();
        };
    }, [ohlcv, forecast]);

    const formatPrice = (p: number) => (p || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatVol = (v: number) => {
        if (v >= 10000000) return (v / 10000000).toFixed(2) + 'Cr';
        if (v >= 100000) return (v / 100000).toFixed(2) + 'L';
        return v.toLocaleString('en-IN');
    };

    return (
        <div className="w-full glass-card overflow-hidden flex flex-col min-h-[500px] relative border-white/5 shadow-2xl group hover:border-white/10 transition-all duration-500">
            {/* Gloss Effect Overlay */}
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-transparent pointer-events-none" />
            
            {/* Header / Legend */}
            <div className="flex items-center justify-between p-6 border-b border-white/5 shrink-0 z-10 bg-void/40 backdrop-blur-xl">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                         <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                             <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                         </div>
                         <h3 className="font-display font-bold text-white text-[10px] tracking-[0.2em] uppercase">
                            Neural Terminal <span className="text-slate-500 ml-1">Live Inference</span>
                         </h3>
                    </div>
                    {legendData && (
                        <div className="flex items-center gap-4 font-mono text-[10px] tracking-tight font-bold">
                            <span className="flex items-center gap-1.5"><span className="text-slate-500">O</span> <span className="text-white">{formatPrice(legendData.open)}</span></span>
                            <span className="flex items-center gap-1.5"><span className="text-slate-500">H</span> <span className="text-white">{formatPrice(legendData.high)}</span></span>
                            <span className="flex items-center gap-1.5"><span className="text-slate-500">L</span> <span className="text-white">{formatPrice(legendData.low)}</span></span>
                            <span className="flex items-center gap-1.5"><span className="text-slate-500">C</span> <span className={legendData.close >= legendData.open ? 'text-emerald-400' : 'text-rose-400'}>{formatPrice(legendData.close)}</span></span>
                            <div className="w-px h-3 bg-white/10 mx-1" />
                            <span className="flex items-center gap-1.5"><span className="text-slate-500">V</span> <span className="text-white tracking-widest">{formatVol(legendData.volume)}</span></span>
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-[10px] font-black tracking-widest uppercase transition-all duration-500 ${action === 'BUY' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : action === 'SELL' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>
                        {action === 'BUY' ? <TrendingUp size={12} /> : action === 'SELL' ? <TrendingDown size={12} /> : <Activity size={12} />}
                        {action} TRIGGER
                    </div>
                </div>
            </div>

            {/* Chart Body */}
            <div className="flex-1 w-full relative group">
                {/* Watermark/Logo overlay */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] select-none flex flex-col items-center">
                    <BarChart3 size={120} className="text-white mb-4" />
                    <span className="font-display font-black text-4xl tracking-widest text-white italic">APEX NEURAL v3</span>
                </div>
                <div className="absolute inset-0 z-0 h-[420px]" ref={chartContainerRef} />
            </div>
        </div>
    );
};

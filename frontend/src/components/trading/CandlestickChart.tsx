import React, { useEffect, useRef, useState } from 'react';
import {
    createChart,
    ColorType,
    SeriesType,
    LineStyle,
    IChartApi
} from 'lightweight-charts';

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
    ohlcv: OHLCVPoint[];
    forecast: ForecastPoint[];
    action: string;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({ ohlcv, forecast, action }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [legendData, setLegendData] = useState<OHLCVPoint | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current || !ohlcv.length) return;

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
            }
        };

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#020409' },
                textColor: '#546e7a',
            },
            grid: {
                vertLines: { color: '#1a2035' },
                horzLines: { color: '#1a2035' },
            },
            crosshair: {
                mode: 0,
                vertLine: {
                    color: '#00e5ff',
                    width: 1,
                    style: LineStyle.Solid,
                    labelBackgroundColor: '#00e5ff',
                },
                horzLine: {
                    color: '#00e5ff',
                    width: 1,
                    style: LineStyle.Solid,
                    labelBackgroundColor: '#00e5ff',
                },
            },
            timeScale: {
                borderColor: '#1a2035',
                timeVisible: true,
                secondsVisible: false,
            },
            rightPriceScale: {
                borderColor: '#1a2035',
            },
            width: chartContainerRef.current.clientWidth,
            height: 420,
        });
        chartRef.current = chart;

        // 1. Candlestick Series
        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#00e676',
            downColor: '#ff1744',
            borderVisible: false,
            wickUpColor: '#00e676',
            wickDownColor: '#ff1744',
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
            color: p.close >= p.open ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 23, 68, 0.4)',
        })).sort((a, b) => (a.time > b.time ? 1 : -1));

        volumeSeries.setData(formattedVolume);

        // 3. Forecast Lines
        if (forecast.length) {
            const p10Series = chart.addLineSeries({ color: '#ff1744', lineWidth: 1, lineStyle: LineStyle.Dashed });
            const p50Series = chart.addLineSeries({ color: '#00e5ff', lineWidth: 2, lineStyle: LineStyle.Dashed });
            const p90Series = chart.addLineSeries({ color: '#00e676', lineWidth: 1, lineStyle: LineStyle.Dashed });

            const lastHistorical = formattedOhlc[formattedOhlc.length - 1];

            // Start forecast lines from last historical close for continuity
            const p10Data = [{ time: lastHistorical.time, value: lastHistorical.close }];
            const p50Data = [{ time: lastHistorical.time, value: lastHistorical.close }];
            const p90Data = [{ time: lastHistorical.time, value: lastHistorical.close }];

            forecast.forEach(f => {
                const t = (isNaN(Number(f.time)) ? f.time : Number(f.time)) as any;
                p10Data.push({ time: t, value: f.p10 });
                p50Data.push({ time: t, value: f.p50 });
                p90Data.push({ time: t, value: f.p90 });
            });

            p10Series.setData(p10Data.sort((a, b) => (a.time > b.time ? 1 : -1)));
            p50Series.setData(p50Data.sort((a, b) => (a.time > b.time ? 1 : -1)));
            p90Series.setData(p90Data.sort((a, b) => (a.time > b.time ? 1 : -1)));

            // 4. NOW line
            p50Series.createPriceLine({
                price: lastHistorical.close,
                color: '#ffc400',
                lineWidth: 1,
                lineStyle: LineStyle.Solid,
                axisLabelVisible: true,
                title: 'NOW',
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
        <div className="w-full bg-surface rounded-xl border border-dim flex flex-col min-h-[420px] relative overflow-hidden">
            {/* Header / Legend */}
            <div className="flex items-center justify-between p-4 border-b border-dim shrink-0 z-10 bg-surface/80 backdrop-blur-sm">
                <div className="flex flex-col gap-1">
                    <h3 className="font-display font-medium text-primary text-xs tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan glow-cyan" /> TERMINAL VIEW
                    </h3>
                    {legendData && (
                        <div className="flex items-center gap-3 font-data text-[10px] tracking-tight text-secondary">
                            <span className="uppercase">O:<span className="text-primary ml-1">{formatPrice(legendData.open)}</span></span>
                            <span className="uppercase">H:<span className="text-primary ml-1">{formatPrice(legendData.high)}</span></span>
                            <span className="uppercase">L:<span className="text-primary ml-1">{formatPrice(legendData.low)}</span></span>
                            <span className="uppercase">C:<span className={legendData.close >= legendData.open ? 'text-green ml-1' : 'text-red ml-1'}>{formatPrice(legendData.close)}</span></span>
                            <span className="uppercase">V:<span className="text-primary ml-1">{formatVol(legendData.volume)}</span></span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${action === 'BUY' ? 'bg-green/10 border-green text-green' : action === 'SELL' ? 'bg-red/10 border-red text-red' : 'bg-gold/10 border-gold text-gold'}`}>
                        {action} SIGNAL
                    </span>
                </div>
            </div>

            {/* Chart Body */}
            <div className="flex-1 w-full h-[420px]" ref={chartContainerRef} />
        </div>
    );
};

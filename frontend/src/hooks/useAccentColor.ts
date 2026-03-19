import { useState, useEffect } from 'react';

export type MarketRegime = 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'UNKNOWN';

export const useAccentColor = () => {
    const [regime, setRegime] = useState<MarketRegime>('UNKNOWN');
    const [colorClass, setColorClass] = useState('text-cyan');
    const [glowClass, setGlowClass] = useState('glow-cyan');
    const [borderClass, setBorderClass] = useState('border-cyan/20');
    const [bgClass, setBgClass] = useState('bg-cyan/5');

    useEffect(() => {
        const fetchRegime = () => {
            fetch('/api/regime')
                .then(res => res.json())
                .then(data => {
                    setRegime(data.regime);
                    switch (data.regime) {
                        case 'BULLISH':
                            setColorClass('text-emerald');
                            setGlowClass('glow-emerald');
                            setBorderClass('border-emerald/20');
                            setBgClass('bg-emerald/5');
                            break;
                        case 'BEARISH':
                            setColorClass('text-rose');
                            setGlowClass('glow-rose');
                            setBorderClass('border-rose/20');
                            setBgClass('bg-rose/5');
                            break;
                        case 'SIDEWAYS':
                        default:
                            setColorClass('text-cyan');
                            setGlowClass('glow-cyan');
                            setBorderClass('border-cyan/20');
                            setBgClass('bg-cyan/5');
                            break;
                    }
                })
                .catch(() => {
                    setRegime('UNKNOWN');
                    setColorClass('text-cyan');
                    setGlowClass('glow-cyan');
                });
        };

        fetchRegime();
        const interval = setInterval(fetchRegime, 120000); // Poll every 2 mins
        return () => clearInterval(interval);
    }, []);

    return { regime, colorClass, glowClass, borderClass, bgClass };
};

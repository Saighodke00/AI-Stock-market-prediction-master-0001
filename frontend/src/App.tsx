import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import { Topbar } from './components/layout/Topbar';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { TickerTape } from './components/layout/TickerTape';

import { SwingTradingPage } from './pages/SwingTrading';
import { IntradayTradingPage } from './pages/IntradayTrading';
import ScreenerPage from './pages/Screener';
import { DashboardPage } from './pages/Dashboard';
import SentimentPage from './pages/SentimentPage';
import PaperTradingPage from './pages/PaperTradingPage';
import { UnderConstructionPage } from './pages/UnderConstruction';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import { PatternsPage } from './pages/PatternsPage';
import { HyperTunerPage } from './pages/HyperTunerPage';
import { GeoMapPage } from './pages/GeoMapPage';

function App() {
    return (
        <Router>
            <div className="flex flex-col h-screen overflow-hidden bg-base text-primary font-body">
                {/* TOPBAR */}
                <Topbar />

                {/* MIDDLE SECTION */}
                <div className="flex flex-1 overflow-hidden">
                    <LeftSidebar />

                    <main className="flex-1 relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-void via-base to-base overflow-y-auto custom-scrollbar">
                        <div className="h-full w-full">
                            <ErrorBoundary>
                                <Routes>
                                    <Route path="/" element={<DashboardPage />} />
                                    <Route path="/swing" element={<SwingTradingPage />} />
                                    <Route path="/intraday" element={<IntradayTradingPage />} />
                                    <Route path="/screener" element={<ScreenerPage />} />
                                    <Route path="/patterns" element={<PatternsPage />} />
                                    <Route path="/sentiment" element={<SentimentPage />} />
                                    <Route path="/paper" element={<PaperTradingPage />} />
                                    <Route path="/tuner" element={<HyperTunerPage />} />
                                    <Route path="/geo" element={<GeoMapPage />} />
                                </Routes>
                            </ErrorBoundary>
                        </div>
                    </main>

                </div>

                {/* BOTTOM TICKER TAPE */}
                <TickerTape />
            </div>
        </Router>
    );
}

export default App;

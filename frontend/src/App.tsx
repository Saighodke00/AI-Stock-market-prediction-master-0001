import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import { Topbar } from './components/layout/Topbar';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { TickerTape } from './components/layout/TickerTape';

import { SwingTradingPage } from './pages/SwingTrading';
import { IntradayTradingPage } from './pages/IntradayTrading';
import { ScreenerPage } from './pages/Screener';
import { DashboardPage } from './pages/Dashboard';
import { UnderConstructionPage } from './pages/UnderConstruction';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Remaining Placeholder pages
const Patterns = () => <UnderConstructionPage title="Pattern Intelligence" />;
const Sentiment = () => <UnderConstructionPage title="Sentiment Deep-Dive" />;
const PaperTrading = () => <UnderConstructionPage title="Paper Trading Engine" />;
const HyperTuner = () => <UnderConstructionPage title="Hyperparameter Tuner" />;

function App() {
    return (
        <Router>
            <div className="flex flex-col h-screen overflow-hidden bg-base text-primary font-body">
                {/* TOPBAR */}
                <Topbar />

                {/* MIDDLE SECTION */}
                <div className="flex flex-1 overflow-hidden">
                    <LeftSidebar />

                    <main className="flex-1 overflow-y-auto relative animate-page-in bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-void via-base to-base">
                        <ErrorBoundary>
                            <Routes>
                                <Route path="/" element={<DashboardPage />} />
                                <Route path="/swing" element={<SwingTradingPage />} />
                                <Route path="/intraday" element={<IntradayTradingPage />} />
                                <Route path="/screener" element={<ScreenerPage />} />
                                <Route path="/patterns" element={<Patterns />} />
                                <Route path="/sentiment" element={<Sentiment />} />
                                <Route path="/paper" element={<PaperTrading />} />
                                <Route path="/tuner" element={<HyperTuner />} />
                            </Routes>
                        </ErrorBoundary>
                    </main>

                </div>

                {/* BOTTOM TICKER TAPE */}
                <TickerTape />
            </div>
        </Router>
    );
}

export default App;

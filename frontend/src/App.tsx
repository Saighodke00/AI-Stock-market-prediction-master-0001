import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import { Topbar } from './components/layout/Topbar';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { TickerTape } from './components/layout/TickerTape';

import { SwingTradingPage } from './pages/SwingTrading';
import { IntradayTradingPage } from './pages/IntradayTrading';
import ScreenerPage from './pages/Screener';
import { DashboardPage } from './pages/Dashboard';
import PaperTradingPage from './pages/PaperTradingPage';
import { UnderConstructionPage } from './pages/UnderConstruction';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import { HyperTunerPage } from './pages/HyperTunerPage';
import { GeoMapPage } from './pages/GeoMapPage';

import Login from './pages/Login';
import Signup from './pages/Signup';
import AdminDashboard from './pages/AdminDashboard';
import { useAuthStore } from './store/useAuthStore';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const isAuthenticated = useAuthStore(state => state.isAuthenticated);
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const user = useAuthStore(state => state.user);
    return user?.role === 'ADMIN' ? <>{children}</> : <Navigate to="/" />;
};

const RootLayout = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col h-screen overflow-hidden bg-base text-primary font-body">
        {/* TOPBAR */}
        <Topbar />

        {/* MIDDLE SECTION */}
        <div className="flex flex-1 overflow-hidden">
            <LeftSidebar />

            <main className="flex-1 relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-void via-base to-base overflow-y-auto custom-scrollbar">
                <div className="h-full w-full">
                    <ErrorBoundary>
                        {children}
                    </ErrorBoundary>
                </div>
            </main>
        </div>

        {/* BOTTOM TICKER TAPE */}
        <TickerTape />
    </div>
);

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                <Route path="/*" element={
                    <ProtectedRoute>
                        <RootLayout>
                            <Routes>
                                <Route path="/" element={<DashboardPage />} />
                                <Route path="/swing" element={<SwingTradingPage />} />
                                <Route path="/intraday" element={<IntradayTradingPage />} />
                                <Route path="/screener" element={<ScreenerPage />} />
                                <Route path="/paper" element={<PaperTradingPage />} />
                                <Route path="/tuner" element={<HyperTunerPage />} />
                                <Route path="/geo" element={<GeoMapPage />} />
                                <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                            </Routes>
                        </RootLayout>
                    </ProtectedRoute>
                } />
            </Routes>
        </Router>
    );
}

export default App;

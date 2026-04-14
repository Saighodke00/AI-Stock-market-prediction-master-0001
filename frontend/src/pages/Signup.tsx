import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/api';
import { AlertCircle, Lock, User as UserIcon, Mail, ShieldCheck, Zap } from 'lucide-react';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await registerUser({ username, email, password });
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-md w-full glass-card p-10 relative z-10 border border-white/5 shadow-2xl animate-page-in">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-emerald/10 border border-emerald/30 text-emerald mb-6 shadow-lg shadow-emerald/10 -rotate-3 hover:rotate-0 transition-transform duration-500">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-display font-black tracking-tighter uppercase leading-none">
            APEX <span className="text-emerald glow-emerald">REGISTRY</span>
          </h2>
          <p className="text-text-muted font-data-tiny uppercase tracking-[0.2em] mt-3">
            New operative enlistment
          </p>
        </div>

        {error && (
          <div className="mb-8 p-4 rounded-xl bg-rose/5 border border-rose/30 flex items-start gap-3 animate-pulse">
            <AlertCircle className="w-5 h-5 text-rose shrink-0 mt-0.5" />
            <p className="text-xs font-data text-rose">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="font-data-tiny text-text-muted uppercase tracking-widest ml-1">Agent Identifier</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted group-focus-within:text-emerald transition-colors">
                <UserIcon className="h-4 w-4" />
              </div>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full bg-white/5 border border-border-dim focus:border-emerald/50 focus:ring-0 rounded-xl py-3 pl-11 pr-4 text-text-primary font-data text-sm placeholder-text-muted/30 transition-all"
                placeholder="neo"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="font-data-tiny text-text-muted uppercase tracking-widest ml-1">Comms Link (Email)</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted group-focus-within:text-emerald transition-colors">
                <Mail className="h-4 w-4" />
              </div>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-white/5 border border-border-dim focus:border-emerald/50 focus:ring-0 rounded-xl py-3 pl-11 pr-4 text-text-primary font-data text-sm placeholder-text-muted/30 transition-all"
                placeholder="neo@matrix.com"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="font-data-tiny text-text-muted uppercase tracking-widest ml-1">Encryption Cipher</label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-muted group-focus-within:text-emerald transition-colors">
                <Lock className="h-4 w-4" />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-border-dim focus:border-emerald/50 focus:ring-0 rounded-xl py-3 pl-11 pr-4 text-text-primary font-data text-sm placeholder-text-muted/30 transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 px-6 bg-emerald/10 border border-emerald/30 text-emerald font-display font-black tracking-widest rounded-xl shadow-lg shadow-emerald/5 hover:bg-emerald/20 active:scale-95 transition-all disabled:opacity-50 mt-6 flex items-center justify-center gap-2 group"
          >
            {loading ? (
              <><Zap className="w-4 h-4 animate-spin" /> GENERATING...</>
            ) : (
              <><Zap className="w-4 h-4 group-hover:fill-emerald transition-all" /> INITIALIZE CLEARANCE</>
            )}
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-xs font-data-small text-text-muted uppercase tracking-widest">
            Already authorized? <Link to="/login" className="text-emerald hover:text-white transition-colors ml-1 font-bold underline decoration-emerald/30 underline-offset-4">Access Terminal</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

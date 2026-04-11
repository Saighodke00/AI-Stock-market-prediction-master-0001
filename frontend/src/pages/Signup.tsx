import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../api/api';
import { AlertCircle, Lock, User as UserIcon, Mail } from 'lucide-react';

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
      // Redirect to login after successful registration
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#111827] rounded-xl border border-[#1f2937] p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10 text-blue-400 mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold font-display tracking-wider">USER REGISTRATION</h2>
          <p className="text-gray-400 mt-2">Create your operative account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <UserIcon className="h-5 w-5" />
              </div>
              <input 
                type="text" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full bg-[#0d1320] border border-[#1f2937] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-600 transition-colors"
                placeholder="neo"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Mail className="h-5 w-5" />
              </div>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-[#0d1320] border border-[#1f2937] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-600 transition-colors"
                placeholder="neo@matrix.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                <Lock className="h-5 w-5" />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                maxLength={72}
                className="w-full bg-[#0d1320] border border-[#1f2937] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder-gray-600 transition-colors"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-6 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg shadow-[0_0_15px_rgba(37,99,235,0.3)] transition-all disabled:opacity-50"
          >
            {loading ? 'GENERATING PROTOCOLS...' : 'CREATE ACCOUNT'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account? <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">Sign In</Link>
        </p>
      </div>
    </div>
  );
}

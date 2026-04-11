import React, { useEffect, useState } from 'react';
import { fetchAdminUsers, fetchAdminStats, fetchAdminActivity, updateAdminUserRole } from '../api/api';
import { Users, Activity, Settings, Database, ShieldAlert, Cpu } from 'lucide-react';
import GlassCard from '../components/ui/GlassCard';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const [st, usrs, acts] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
        fetchAdminActivity()
      ]);
      setStats(st);
      setUsers(usrs);
      setActivities(acts);
    } catch (err) {
      console.error("Failed loading admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleToggleRole = async (userId: number, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    if (!window.confirm(`Are you sure you want to change this agent's clearance to ${newRole}?`)) return;

    try {
      await updateAdminUserRole(userId, newRole);
      // Refresh list
      loadAdminData();
    } catch (err: any) {
      alert(err.message || "Failed to update role");
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-6 flex flex-col items-center justify-center min-h-[500px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-blue-400 font-display tracking-widest text-sm">ACCESSING SECURE MAINFRAME...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-y-auto w-full">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-red-500/10 rounded-xl neon-border border-red-500/30">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-500">
            SYSTEM ADMINISTRATION
          </h1>
          <p className="text-sm text-gray-400">Level 5 Clearance Authorized</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 font-medium">Core Status</p>
              <h3 className="text-2xl font-bold text-green-400 mt-1 uppercase">{stats?.status || 'UNKNOWN'}</h3>
            </div>
            <Cpu className="w-8 h-8 text-green-400 opacity-50" />
          </div>
        </GlassCard>
        
        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 font-medium">Total Agents</p>
              <h3 className="text-2xl font-bold text-blue-400 mt-1">{stats?.total_users || 0}</h3>
            </div>
            <Users className="w-8 h-8 text-blue-400 opacity-50" />
          </div>
        </GlassCard>
        
        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 font-medium">Active (24H)</p>
              <h3 className="text-2xl font-bold text-yellow-400 mt-1">{stats?.active_users_24h || 0}</h3>
            </div>
            <Activity className="w-8 h-8 text-yellow-400 opacity-50" />
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 font-medium">Simulations Executed</p>
              <h3 className="text-2xl font-bold text-purple-400 mt-1">{stats?.total_paper_trades || 0}</h3>
            </div>
            <Database className="w-8 h-8 text-purple-400 opacity-50" />
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-2">
          <GlassCard title="REGISTERED OPERATIVES" icon={<Users className="w-4 h-4 text-blue-400" />}>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm text-left text-gray-400">
                <thead className="text-xs uppercase bg-[#0d1320]/50 border-b border-[#1f2937]">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Clearance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Trades</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-[#1f2937]/50 hover:bg-[#1f2937]/20 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs">{u.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-200">{u.username}</div>
                        <div className="text-xs opacity-70">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${u.role === 'ADMIN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-2 ${u.is_active ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          {u.is_active ? 'Active' : 'Disabled'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{u.total_trades}</td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => handleToggleRole(u.id, u.role)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            u.role === 'ADMIN' 
                            ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500/10' 
                            : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                          }`}
                        >
                          {u.role === 'ADMIN' ? 'Revoke Clearance' : 'Grant Clearance'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>

        <div className="col-span-1">
          <GlassCard title="SYSTEM LOGS" icon={<Activity className="w-4 h-4 text-purple-400" />}>
            <div className="space-y-4 mt-4 pr-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {activities.map((act) => (
                <div key={act.id} className="flex gap-3 relative before:absolute before:left-2.5 before:top-6 before:bottom-[-16px] before:w-[1px] before:bg-[#1f2937] last:before:hidden">
                  <div className="shrink-0 w-5 h-5 rounded-full bg-[#0d1320] border-2 border-[#1f2937] flex items-center justify-center z-10 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-200">{act.username}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">{act.action_type}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(act.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {activities.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-sm">No activity recorded.</div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

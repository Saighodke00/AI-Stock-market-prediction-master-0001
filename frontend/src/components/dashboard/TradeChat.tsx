import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Sparkles, Command } from 'lucide-react';

interface ChatMessage {
    id: string;
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp: string;
}

export const TradeChat: React.FC = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: '1',
            role: 'system',
            content: 'Neural Link Established. APEX AI Core standing by for tactical consultation.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        {
            id: '2',
            role: 'ai',
            content: "Welcome to Trade Architect. I've analyzed the current market breadth—NIFTY is showing strong divergence. How can I assist your strategy today?",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
    ]);
    
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;
        
        const newUserMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        
        setMessages(prev => [...prev, newUserMsg]);
        setInput('');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: input })
            });
            const data = await response.json();
            
            const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'ai',
                content: data.response,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'system',
                content: "Signal link disrupted. Neural processing failed.",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, errorMsg]);
        }
    };


    return (
        <div className="flex flex-col h-[520px] bg-surface/10 backdrop-blur-3xl border border-white/5 rounded-[3rem] overflow-hidden shadow-2xl group transition-all duration-700 hover:border-white/10 relative neon-frame">
            {/* Ambient Background Glow */}
            <div className="absolute -top-20 -right-20 w-80 h-80 bg-cyan/5 rounded-full blur-[120px] group-hover:bg-cyan/10 transition-all duration-1000" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo/5 rounded-full blur-[120px] group-hover:bg-indigo/10 transition-all duration-1000" />

            {/* Chat Header */}
            <div className="px-10 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.01] relative z-10">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-cyan/10 rounded-2xl border border-cyan/20 shadow-lg shadow-cyan/10">
                        <Sparkles size={16} className="text-cyan animate-pulse-glow" />
                    </div>
                    <div>
                        <h3 className="text-[12px] font-display font-black text-white uppercase tracking-[0.4em]">Neural Chat Terminal</h3>
                        <p className="text-[8px] font-data text-cyan/60 font-bold uppercase tracking-widest mt-1 animate-pulse italic">Cognitive Sync Established</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 px-4 py-1.5 bg-void/40 rounded-full border border-white/5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald shadow-[0_0_10px_rgba(16,185,129,0.6)] animate-pulse" />
                    <span className="text-[8px] font-data text-slate-500 font-black uppercase tracking-[0.2em]">Secure Node</span>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar relative z-10">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
                        <div className={`w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center border transition-all duration-500 ${
                            msg.role === 'ai' ? 'bg-cyan/10 border-cyan/20 text-cyan shadow-lg shadow-cyan/5' : 
                            msg.role === 'user' ? 'bg-white/5 border-white/10 text-white shadow-xl' : 
                            'bg-void/40 border-white/5 text-slate-600'
                        }`}>
                            {msg.role === 'ai' ? <Bot size={22} /> : msg.role === 'user' ? <User size={22} /> : <Command size={18} />}
                        </div>
                        
                        <div className={`flex flex-col gap-2.5 max-w-[75%] ${msg.role === 'user' ? 'items-end' : ''}`}>
                            <div className={`px-6 py-4 rounded-[2rem] text-sm leading-relaxed font-body shadow-sm ${
                                msg.role === 'ai' ? 'bg-white/[0.02] border border-white/5 text-slate-300' : 
                                msg.role === 'user' ? 'bg-cyan text-void font-bold shadow-xl shadow-cyan/10' : 
                                'bg-transparent text-slate-500 italic text-[11px] font-data tracking-tight'
                            }`}>
                                {msg.content}
                            </div>
                            <span className="text-[8px] font-data text-slate-600 font-black tracking-[0.2em] uppercase px-2">{msg.timestamp}</span>
                        </div>
                    </div>
                ))}
                <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-10 pt-6 border-t border-white/5 bg-white/[0.005] relative z-10">
                <div className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Inquire for technical guidance..."
                        className="w-full bg-void/40 border border-white/5 rounded-2xl pl-8 pr-16 py-5 font-body text-sm text-white focus:outline-none focus:border-cyan/40 transition-all placeholder-slate-800 shadow-inner group-hover:bg-void/60"
                    />
                    <button
                        onClick={handleSend}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-cyan hover:bg-cyan-400 text-void rounded-xl transition-all shadow-lg shadow-cyan/20 active:scale-95 group-hover:scale-105"
                    >
                        <Send size={18} strokeWidth={3} />
                    </button>
                </div>
                <div className="flex justify-between items-center mt-5 px-4 opacity-40 hover:opacity-100 transition-opacity">
                    <p className="text-[8px] font-data text-slate-500 uppercase tracking-widest font-black">// Execute via ⏎ ENTER</p>
                    <div className="flex gap-6">
                        <span className="text-[8px] font-data text-slate-500 uppercase tracking-[0.2em] font-black hover:text-cyan cursor-pointer transition-colors">Strategic Intelligence</span>
                        <span className="text-[8px] font-data text-slate-500 uppercase tracking-[0.2em] font-black hover:text-cyan cursor-pointer transition-colors">Neural History</span>
                    </div>
                </div>
            </div>
        </div>
    );

};

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, X, Bot, User as UserIcon, ArrowRight, RefreshCw, Zap, Shield, Database, Compass, Plane, UserCheck, Truck, Coins, Fuel, BarChart3, ChevronRight } from 'lucide-react';
import { aiAssistantService, AIResponse } from '../services/aiAssistantService';
import { useOperationalData } from '../context/OperationalDataContext';
import { useFinanceData } from '../context/FinanceDataContext';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  responseObj?: AIResponse;
}

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  initialQuery?: string;
}

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
  initialQuery = ''
}) => {
  const { tanks, flightJobs, equipment, staff, alerts } = useOperationalData();
  const financeContext = useFinanceData();
  
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize welcoming message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'ai',
          text: 'Hello! I am your **MACL FMS AI Assistant**. Ask me about Fuel Uplifts (e.g., *"How much fuel does SU321 usually uplift?"*), Tank Levels, Active Flights, Staff RC Numbers, or Finance Balances.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, []);

  // Process initial query if provided from top search bar or floating button
  useEffect(() => {
    if (initialQuery.trim() && isOpen) {
      handleSendQuery(initialQuery);
    }
  }, [initialQuery, isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  if (!isOpen) return null;

  const handleSendQuery = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const response = aiAssistantService.processQuery(query, {
        tanks,
        flightJobs,
        equipment,
        staff,
        alerts,
        financeCustomers: financeContext?.customers
      });

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        responseObj: response
      };

      setMessages(prev => [...prev, aiMsg]);
      setIsTyping(false);
    }, 400);
  };

  const quickPrompts = [
    { label: 'SU321 Fuel Uplift History', icon: <Plane className="w-3.5 h-3.5 text-primary" />, query: 'How much fuel does SU321 usually uplift?' },
    { label: 'Check Tank Levels', icon: <Fuel className="w-3.5 h-3.5 text-primary" />, query: 'Check Tank Levels' },
    { label: 'Active Flights In Progress', icon: <BarChart3 className="w-3.5 h-3.5 text-primary" />, query: 'Active Flights In Progress' },
    { label: 'Who is A-6600?', icon: <UserCheck className="w-3.5 h-3.5 text-primary" />, query: 'Who is A-6600?' },
    { label: 'Fleet Equipment Status', icon: <Truck className="w-3.5 h-3.5 text-primary" />, query: 'Fleet Equipment Status' },
    { label: 'Emirates Account Balance', icon: <Coins className="w-3.5 h-3.5 text-primary" />, query: 'Emirates Account Balance' }
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-surface border border-outline rounded-[36px] shadow-premium overflow-hidden flex flex-col h-[650px] max-h-[90vh] relative">
        
        {/* Header - Adapts dynamically to Light / Dark / Black themes */}
        <div className="p-5 bg-surface-dim border-b border-outline flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl kinetic-gradient flex items-center justify-center text-white shadow-premium">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-black text-on-surface uppercase tracking-tight">MACL FMS AI Assistant</h3>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded-full uppercase tracking-wider border border-primary/20">
                  Live Engine
                </span>
              </div>
              <p className="text-[10px] font-bold text-on-surface-dim opacity-50 uppercase tracking-widest mt-0.5">
                Real-time Flight Logs & Operations Intelligence
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-on-surface-dim hover:text-primary hover:bg-surface-container transition-all border border-transparent hover:border-outline"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar bg-surface-lowest/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.sender === 'user'
                  ? 'kinetic-gradient text-white shadow-sm'
                  : 'bg-surface-container-high text-primary border border-outline'
              }`}>
                {msg.sender === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`max-w-[85%] rounded-3xl p-4 text-xs font-semibold leading-relaxed space-y-3 transition-all ${
                msg.sender === 'user'
                  ? 'kinetic-gradient text-white rounded-tr-none shadow-md font-bold'
                  : 'bg-surface border border-outline hover:border-primary/40 text-on-surface rounded-tl-none shadow-premium'
              }`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Response Highlights Badge Grid */}
                {msg.responseObj?.highlights && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline/40">
                    {msg.responseObj.highlights.map((h, i) => (
                      <div key={i} className="bg-surface-dim p-2 rounded-xl border border-outline/30">
                        <span className="text-[8px] font-black text-on-surface-dim opacity-50 uppercase tracking-widest block">{h.label}</span>
                        <span className="text-[11px] font-black text-primary">{h.value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Direct Action Link Button */}
                {msg.responseObj?.action && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        onClose();
                        onNavigate(msg.responseObj!.action!.view);
                      }}
                      className="w-full py-2.5 px-3 bg-primary/10 hover:bg-primary text-primary hover:text-black border border-primary/30 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center space-x-2 group shadow-sm active:scale-95"
                    >
                      <span className="group-hover:text-black transition-colors">{msg.responseObj.action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:text-black group-hover:translate-x-1 transition-all" />
                    </button>
                  </div>
                )}

                <div className={`text-[8px] font-bold ${msg.sender === 'user' ? 'text-white/70 text-right' : 'text-on-surface-dim opacity-40'}`}>
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center space-x-3 fade-in">
              <div className="w-8 h-8 rounded-xl bg-surface-container-high text-primary border border-outline flex items-center justify-center">
                <Bot className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-surface border border-outline p-3 rounded-2xl text-xs font-bold text-on-surface-dim flex items-center space-x-2 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                <span>Scanning flight logs & module records...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Quick Prompts Suggestions Bar */}
        <div className="px-5 py-2.5 bg-surface-dim border-t border-outline flex items-center space-x-2 overflow-x-auto custom-scrollbar">
          <span className="text-[9px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest shrink-0 mr-1">Suggestions:</span>
          {quickPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSendQuery(p.query)}
              className="px-3 py-1.5 bg-surface hover:bg-primary hover:text-black hover:border-primary border border-outline rounded-xl text-[10px] font-bold text-on-surface-dim whitespace-nowrap transition-all active:scale-95 shrink-0 flex items-center space-x-1.5 group"
            >
              {React.cloneElement(p.icon, { className: 'w-3.5 h-3.5 text-primary group-hover:text-black transition-colors' })}
              <span className="group-hover:text-black transition-colors">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendQuery(); }}
          className="p-4 bg-surface-dim border-t border-outline flex items-center space-x-3"
        >
          <div className="relative flex-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask AI about fuel uplifts (e.g. SU321), tanks, staff RC, or finance..."
              className="w-full pl-11 pr-4 py-3 bg-surface border border-outline focus:border-primary rounded-2xl text-xs font-bold text-on-surface focus:outline-none transition-all placeholder:text-on-surface-dim/40"
            />
            <Sparkles className="w-4 h-4 text-primary absolute left-4 top-1/2 -translate-y-1/2" />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-12 h-12 rounded-2xl kinetic-gradient text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-40 shadow-premium shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

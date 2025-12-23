
import React, { useState, useEffect } from 'react';
import { Agent, VoiceName, Incident, ModelProvider } from './types';
import { AgentEditor } from './components/AgentEditor';
import { LivePlayground } from './components/LivePlayground';
import { EmbedModal } from './components/EmbedModal';

const DEFAULT_AGENTS: Agent[] = [
  {
    id: '1',
    name: 'Zenith Support',
    clientName: 'Global Cloud',
    icon: 'fa-headset',
    description: 'Expert customer support with a calm demeanor.',
    detailedDescription: 'Zenith handles high-end SaaS platform incidents with extreme empathy.',
    systemInstruction: 'You are Zenith, a premium customer support agent for Global Cloud.',
    voice: VoiceName.Zephyr,
    provider: ModelProvider.GEMINI,
    modelId: 'gemini-2.5-flash-native-audio-preview',
    tools: [],
    createdAt: Date.now()
  },
  {
    id: '2',
    name: 'Titan Firewall',
    clientName: 'SecureNet',
    icon: 'fa-shield-halved',
    description: 'Security incident responder.',
    detailedDescription: 'Titan is an AI engineer focused on mitigating security breaches and server outages.',
    systemInstruction: 'You are Titan, a security expert for SecureNet. Resolve technical crises efficiently.',
    voice: VoiceName.Fenrir,
    provider: ModelProvider.DEEPSEEK,
    modelId: 'deepseek-v3',
    tools: [],
    createdAt: Date.now() - 86400000
  }
];

export default function App() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | undefined>();
  const [playgroundAgent, setPlaygroundAgent] = useState<Agent | null>(null);
  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [embedAgent, setEmbedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    const savedAgents = localStorage.getItem('voxbuild_agents');
    const savedIncidents = localStorage.getItem('voxbuild_incidents');
    if (savedAgents) setAgents(JSON.parse(savedAgents));
    else setAgents(DEFAULT_AGENTS);
    if (savedIncidents) setIncidents(JSON.parse(savedIncidents));
  }, []);

  const saveAgents = (newAgents: Agent[]) => {
    setAgents(newAgents);
    localStorage.setItem('voxbuild_agents', JSON.stringify(newAgents));
  };

  const saveIncidents = (newIncidents: Incident[]) => {
    setIncidents(newIncidents);
    localStorage.setItem('voxbuild_incidents', JSON.stringify(newIncidents));
  };

  const triggerIncident = () => {
    const randomClient = agents[Math.floor(Math.random() * agents.length)]?.clientName || 'Acme Corp';
    const newInc: Incident = {
      id: Math.random().toString(36).substr(2, 9),
      clientName: randomClient,
      title: `${randomClient} System Failure`,
      description: 'Critical database latency detected in production clusters.',
      priority: 'critical', status: 'active', createdAt: Date.now()
    };
    saveIncidents([newInc, ...incidents]);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col">
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg"><i className="fa-solid fa-tower-broadcast text-white"></i></div>
            <span className="text-xl font-bold tracking-tight">VoxBuild <span className="text-indigo-400 text-sm">PRO</span></span>
          </div>
          <div className="flex gap-4">
            <button onClick={triggerIncident} className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-lg animate-pulse">INCIDENT SIM</button>
            <button onClick={() => { setEditingAgent(undefined); setIsEditorOpen(true); }} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-lg">NEW AGENT</button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto px-4 py-10 w-full grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Response Log</h3>
              <span className="text-[8px] bg-red-600/20 text-red-400 px-2 py-0.5 rounded-full font-bold">{incidents.length}</span>
            </div>
            <div className="p-2 space-y-2 max-h-[70vh] overflow-y-auto">
              {incidents.map(inc => (
                <div key={inc.id} className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">{inc.clientName}</span>
                    <span className="text-[8px] bg-red-600 text-white px-1 rounded font-black">{inc.priority}</span>
                  </div>
                  <h4 className="text-[11px] font-bold mb-2 leading-tight">{inc.title}</h4>
                  <button onClick={() => {
                    const agent = agents.find(a => a.clientName === inc.clientName);
                    if (agent) { setPlaygroundAgent(agent); setActiveIncident(inc); }
                  }} className="w-full bg-indigo-600 text-[10px] font-black py-1.5 rounded uppercase tracking-widest">Respond</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {agents.map(agent => (
              <div key={agent.id} className="glass rounded-2xl p-6 border border-slate-800 flex flex-col hover:border-indigo-500/30 transition-all shadow-xl group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 group-hover:bg-indigo-600/10 transition-colors"><i className={`fa-solid ${agent.icon} text-indigo-400 text-xl`}></i></div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        <i className="fa-solid fa-microchip text-[8px]"></i> {agent.provider}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono truncate max-w-[120px]">{agent.modelId}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEmbedAgent(agent)} className="p-2 text-slate-500 hover:text-indigo-400"><i className="fa-solid fa-code"></i></button>
                    <button onClick={() => { setEditingAgent(agent); setIsEditorOpen(true); }} className="p-2 text-slate-500 hover:text-white"><i className="fa-solid fa-sliders"></i></button>
                  </div>
                </div>
                <div className="mb-2">
                  <h3 className="text-xl font-bold">{agent.name}</h3>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CLIENT: {agent.clientName}</div>
                </div>
                <p className="text-slate-400 text-sm mb-6 flex-1 italic leading-relaxed">"{agent.description}"</p>
                <button onClick={() => { setPlaygroundAgent(agent); setActiveIncident(null); }} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all">Test Voice Agent</button>
              </div>
            ))}
            <button onClick={() => { setEditingAgent(undefined); setIsEditorOpen(true); }} className="border-2 border-dashed border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all text-slate-600 hover:text-indigo-400 min-h-[250px]">
              <i className="fa-solid fa-plus text-2xl"></i>
              <span className="font-bold text-sm uppercase">Add Response Node</span>
            </button>
          </div>
        </div>
      </main>

      {isEditorOpen && <AgentEditor initialAgent={editingAgent} onSave={(a) => { const exists = agents.find(ag => ag.id === a.id); if (exists) saveAgents(agents.map(ag => ag.id === a.id ? a : ag)); else saveAgents([a, ...agents]); setIsEditorOpen(false); }} onCancel={() => setIsEditorOpen(false)} />}
      {playgroundAgent && <LivePlayground agent={playgroundAgent} incident={activeIncident} onClose={() => { setPlaygroundAgent(null); setActiveIncident(null); }} />}
      {embedAgent && <EmbedModal agent={embedAgent} onClose={() => setEmbedAgent(null)} />}
    </div>
  );
}

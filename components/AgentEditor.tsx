
import React, { useState, useEffect, useRef } from 'react';
import { Agent, VoiceName, AgentTool, ToolParameters, ModelProvider } from '../types';

interface AgentEditorProps {
  initialAgent?: Agent;
  onSave: (agent: Agent) => void;
  onCancel: () => void;
}

const AVAILABLE_ICONS = [
  'fa-robot', 'fa-user-tie', 'fa-headset', 'fa-microphone-lines', 'fa-brain', 
  'fa-bolt', 'fa-shield-halved', 'fa-gem', 'fa-rocket', 'fa-heart-pulse', 
  'fa-graduation-cap', 'fa-language'
];

const PROVIDER_MODELS: Record<ModelProvider, string[]> = {
  [ModelProvider.GEMINI]: ['gemini-3-flash-preview', 'gemini-3-pro-preview', 'gemini-2.5-flash-native-audio-preview-09-2025'],
  [ModelProvider.OPENAI]: ['gpt-4o-realtime', 'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4o'],
  [ModelProvider.DEEPSEEK]: ['deepseek-v3', 'deepseek-coder', 'deepseek-r1'],
  [ModelProvider.ANTHROPIC]: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku']
};

export const AgentEditor: React.FC<AgentEditorProps> = ({ initialAgent, onSave, onCancel }) => {
  const [name, setName] = useState(initialAgent?.name || '');
  const [clientName, setClientName] = useState(initialAgent?.clientName || '');
  const [icon, setIcon] = useState(initialAgent?.icon || 'fa-robot');
  const [description, setDescription] = useState(initialAgent?.description || '');
  const [detailedDescription, setDetailedDescription] = useState(initialAgent?.detailedDescription || '');
  const [systemInstruction, setSystemInstruction] = useState(initialAgent?.systemInstruction || '');
  const [voice, setVoice] = useState<VoiceName>(initialAgent?.voice || VoiceName.Zephyr);
  const [voiceSample, setVoiceSample] = useState<string | undefined>(initialAgent?.voiceSample);
  const [webhookUrl, setWebhookUrl] = useState(initialAgent?.webhookUrl || '');
  const [provider, setProvider] = useState<ModelProvider>(initialAgent?.provider || ModelProvider.GEMINI);
  const [modelId, setModelId] = useState(initialAgent?.modelId || PROVIDER_MODELS[ModelProvider.GEMINI][0]);
  const [tools, setTools] = useState<AgentTool[]>(initialAgent?.tools || []);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toolParamsStrings, setToolParamsStrings] = useState<Record<string, string>>({});

  useEffect(() => {
    const initialStrings: Record<string, string> = {};
    tools.forEach(tool => {
      initialStrings[tool.id] = JSON.stringify(tool.parameters, null, 2);
    });
    setToolParamsStrings(initialStrings);
  }, [tools]);

  const handleProviderChange = (p: ModelProvider) => {
    setProvider(p);
    setModelId(PROVIDER_MODELS[p][0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    for (const tool of tools) {
      try { JSON.parse(toolParamsStrings[tool.id] || '{}'); } 
      catch (err) { alert(`Invalid JSON parameters for tool: ${tool.name}`); return; }
    }

    onSave({
      id: initialAgent?.id || Math.random().toString(36).substr(2, 9),
      name,
      clientName: clientName || 'General',
      icon,
      description,
      detailedDescription,
      systemInstruction,
      voice,
      voiceSample,
      webhookUrl,
      provider,
      modelId,
      tools: tools.map(t => ({
        ...t,
        parameters: JSON.parse(toolParamsStrings[t.id] || '{"type":"object","properties":{}}')
      })),
      createdAt: initialAgent?.createdAt || Date.now()
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => setVoiceSample(reader.result as string);
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      timerRef.current = window.setInterval(() => setRecordingDuration(prev => prev + 1), 1000);
    } catch (err) {
      alert('Could not access microphone for recording.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = () => setVoiceSample(reader.result as string);
    }
  };

  const addTool = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const defaultParams: ToolParameters = { type: 'object', properties: {} };
    const newTool: AgentTool = {
      id, name: 'new_tool', description: 'Description...', 
      parameters: defaultParams, useWebhook: !!webhookUrl, requireConfirmation: false
    };
    setTools([...tools, newTool]);
    setToolParamsStrings(prev => ({ ...prev, [id]: JSON.stringify(defaultParams, null, 2) }));
  };

  const removeTool = (id: string) => {
    setTools(tools.filter(t => t.id !== id));
    const nextStrings = { ...toolParamsStrings };
    delete nextStrings[id];
    setToolParamsStrings(nextStrings);
  };

  const toggleToolWebhook = (id: string) => {
    setTools(tools.map(t => t.id === id ? { ...t, useWebhook: !t.useWebhook } : t));
  };

  const toggleToolConfirmation = (id: string) => {
    setTools(tools.map(t => t.id === id ? { ...t, requireConfirmation: !t.requireConfirmation } : t));
  };

  const handleParamsChange = (id: string, value: string) => {
    setToolParamsStrings(prev => ({ ...prev, [id]: value }));
  };

  const isJsonValid = (str: string) => {
    try { JSON.parse(str); return true; } catch { return false; }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold">{initialAgent ? 'Edit Dispatcher' : 'Create Global AI Agent'}</h2>
            <p className="text-xs text-slate-400 mt-1">Configure identity, LLM provider, and N8N automation.</p>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white transition-colors p-2">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {/* Engine Selection Section */}
          <div className="p-6 bg-indigo-600/5 border border-indigo-500/20 rounded-2xl space-y-6 shadow-inner">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <i className="fa-solid fa-microchip"></i> LLM Brain Selection
              </h3>
              <div className="text-[10px] text-slate-500 font-mono uppercase">Hybrid Compute Architecture</div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model Provider</label>
                <div className="relative">
                  <select
                    value={provider}
                    onChange={e => handleProviderChange(e.target.value as ModelProvider)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-indigo-400 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                    {Object.values(ModelProvider).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                    <i className="fa-solid fa-chevron-down text-xs"></i>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Model ID</label>
                <div className="relative">
                  <select
                    value={modelId}
                    onChange={e => setModelId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-indigo-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer"
                  >
                    {PROVIDER_MODELS[provider].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                    <i className="fa-solid fa-chevron-down text-xs"></i>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Identity & Client Mapping */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <i className="fa-solid fa-id-card"></i> Identity & Identity Mapping
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Agent Name</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Zenith Support" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Client ID</label>
                  <input type="text" value={clientName} onChange={e => setClientName(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm font-semibold focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Global Corp" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Icon Overlay</label>
                <div className="grid grid-cols-6 gap-2 bg-slate-800/50 p-3 rounded-xl border border-slate-700 shadow-inner">
                  {AVAILABLE_ICONS.map(i => (
                    <button key={i} type="button" onClick={() => setIcon(i)} className={`h-10 rounded-lg transition-all flex items-center justify-center ${icon === i ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}><i className={`fa-solid ${i}`}></i></button>
                  ))}
                </div>
              </div>

              <div className="p-5 bg-slate-800/50 border border-slate-700 rounded-2xl space-y-5 shadow-inner">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Voice Synthesis & Cloning</h3>
                  <div className="text-[10px] text-slate-500 font-mono uppercase">Custom Biometrics</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {Object.values(VoiceName).map(v => (
                    <button key={v} type="button" onClick={() => setVoice(v)} className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${voice === v ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>{v}</button>
                  ))}
                </div>

                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Voice Clone Reference</label>
                  <div className="flex gap-2">
                    {!isRecording ? (
                      <button 
                        type="button" 
                        onClick={startRecording} 
                        className="flex-1 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all border border-slate-600"
                      >
                        <i className="fa-solid fa-microphone"></i> Start Recording
                      </button>
                    ) : (
                      <button 
                        type="button" 
                        onClick={stopRecording} 
                        className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all animate-pulse shadow-lg shadow-red-600/20"
                      >
                        <i className="fa-solid fa-stop"></i> Stop ({recordingDuration}s)
                      </button>
                    )}
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-all border border-slate-600"
                      title="Upload existing audio file"
                    >
                      <i className="fa-solid fa-cloud-arrow-up"></i>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileUpload} />
                  </div>

                  {voiceSample && (
                    <div className="bg-slate-950 p-3 rounded-xl border border-indigo-500/30 space-y-2 mt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-indigo-400 uppercase flex items-center gap-2">
                          <i className="fa-solid fa-circle-check"></i> Sample Loaded
                        </span>
                        <button type="button" onClick={() => setVoiceSample(undefined)} className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase">Clear</button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 w-full animate-pulse opacity-40"></div>
                        </div>
                        <audio controls className="h-8 w-40 custom-audio-mini" src={voiceSample} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Core Intelligence */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <i className="fa-solid fa-brain"></i> Core Logic
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">System Instructions (Context)</label>
                  <textarea required rows={7} value={systemInstruction} onChange={e => setSystemInstruction(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none custom-scrollbar" placeholder="Define the AI persona, rules, and boundaries..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Tagline / Mission</label>
                  <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Helpful assistant for complex queries" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">Detailed Description & Capabilities</label>
                  <textarea rows={3} value={detailedDescription} onChange={e => setDetailedDescription(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm resize-none focus:ring-2 focus:ring-indigo-500 outline-none custom-scrollbar" placeholder="More in-depth information about the agent's capabilities and intended use cases..." />
                </div>
                <div className="p-4 bg-indigo-600/5 border border-indigo-500/20 rounded-2xl">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">N8N Webhook Bridge</label>
                  <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-indigo-400 font-mono text-xs focus:outline-none" placeholder="https://n8n.your-domain.com/webhook/..." />
                </div>
              </div>
            </div>
          </div>

          {/* Capabilities Section */}
          <div className="space-y-4 pt-6 border-t border-slate-800">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                <i className="fa-solid fa-screwdriver-wrench"></i> Integrated Toolsets
              </h3>
              <button type="button" onClick={addTool} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all">+ Add Capability</button>
            </div>
            
            {tools.length === 0 ? (
              <div className="text-center py-10 bg-slate-800/20 rounded-2xl border border-dashed border-slate-700 text-slate-500 text-sm">No external functions defined.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {tools.map((tool, idx) => (
                  <div key={tool.id} className="p-5 bg-slate-800/50 border border-slate-700 rounded-2xl space-y-4 shadow-inner relative group">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 mr-4">
                        <input 
                          className="w-full bg-transparent font-mono text-sm text-indigo-400 focus:outline-none border-b border-transparent focus:border-indigo-500 py-1" 
                          value={tool.name} 
                          onChange={e => { const nt = [...tools]; nt[idx].name = e.target.value.replace(/\s+/g, '_').toLowerCase(); setTools(nt); }} 
                        />
                      </div>
                      <div className="flex flex-col gap-2 items-end">
                        <button type="button" onClick={() => removeTool(tool.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1"><i className="fa-solid fa-trash-can text-sm"></i></button>
                        <div className="flex flex-col gap-1.5">
                           <button
                            type="button"
                            onClick={() => toggleToolWebhook(tool.id)}
                            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${
                              tool.useWebhook 
                                ? 'bg-indigo-600 text-white border-indigo-400' 
                                : 'bg-slate-900 text-slate-600 border-slate-800'
                            }`}
                          >
                            <i className={`fa-solid ${tool.useWebhook ? 'fa-plug-circle-bolt' : 'fa-plug-circle-xmark'}`}></i>
                            {tool.useWebhook ? 'N8N HOOK' : 'LOCAL'}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleToolConfirmation(tool.id)}
                            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all border ${
                              tool.requireConfirmation 
                                ? 'bg-amber-600 text-white border-amber-400' 
                                : 'bg-slate-900 text-slate-600 border-slate-800'
                            }`}
                          >
                            <i className={`fa-solid ${tool.requireConfirmation ? 'fa-lock' : 'fa-lock-open'}`}></i>
                            {tool.requireConfirmation ? 'CONFIRM REQ' : 'AUTO-EXEC'}
                          </button>
                        </div>
                      </div>
                    </div>
                    <textarea 
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 h-16 resize-none focus:outline-none focus:border-indigo-500 custom-scrollbar" 
                      value={tool.description} 
                      onChange={e => { const nt = [...tools]; nt[idx].description = e.target.value; setTools(nt); }} 
                      placeholder="Tool usage context..." 
                    />
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-600 uppercase">JSON Schema Parameters</label>
                      <textarea 
                        className={`w-full bg-slate-950 border ${isJsonValid(toolParamsStrings[tool.id] || '{}') ? 'border-slate-800' : 'border-red-500/50'} rounded-lg px-3 py-2 text-[10px] font-mono text-emerald-500 h-20 resize-none outline-none custom-scrollbar`} 
                        value={toolParamsStrings[tool.id]} 
                        onChange={e => handleParamsChange(tool.id, e.target.value)} 
                        spellCheck={false} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        <div className="p-6 bg-slate-800/95 border-t border-slate-800 flex justify-end gap-3 backdrop-blur-md">
          <button type="button" onClick={onCancel} className="px-6 py-2 rounded-xl text-slate-400 hover:text-white transition-all font-bold text-sm">Cancel</button>
          <button onClick={handleSubmit} className="px-10 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-all shadow-lg text-sm uppercase tracking-widest">Deploy Dispatcher</button>
        </div>
      </div>
      <style>{`
        .custom-audio-mini::-webkit-media-controls-panel { background-color: transparent; }
        .custom-audio-mini::-webkit-media-controls-play-button,
        .custom-audio-mini::-webkit-media-controls-current-time-display,
        .custom-audio-mini::-webkit-media-controls-time-remaining-display,
        .custom-audio-mini::-webkit-media-controls-timeline,
        .custom-audio-mini::-webkit-media-controls-volume-slider { filter: invert(100%) brightness(1.5); }
      `}</style>
    </div>
  );
};

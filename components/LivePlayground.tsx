
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Agent, TranscriptionEntry, AgentTool, Incident, ModelProvider } from '../types';
import { decode, encode, decodeAudioData, createBlob } from '../utils/audioUtils';
import { AudioVisualizer } from './AudioVisualizer';

interface LivePlaygroundProps {
  agent: Agent;
  onClose: () => void;
  incident?: Incident | null;
}

interface PendingConfirmation {
  tool: AgentTool;
  fc: any;
  resolve: (response: any) => void;
}

export const LivePlayground: React.FC<LivePlaygroundProps> = ({ agent, onClose, incident }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [executingTool, setExecutingTool] = useState<AgentTool | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [transcriptions, setTranscriptions] = useState<TranscriptionEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const transcriptionRef = useRef<{ user: string; model: string }>({ user: '', model: '' });

  const stopSession = useCallback(() => {
    if (sessionRef.current) { sessionRef.current.close(); sessionRef.current = null; }
    if (audioContextsRef.current) {
      audioContextsRef.current.input.close();
      audioContextsRef.current.output.close();
      audioContextsRef.current = null;
    }
    setIsConnected(false);
    setIsTalking(false);
    setPendingConfirmation(null);
  }, []);

  const handleToolExecution = async (tool: AgentTool, fc: any) => {
    setExecutingTool(tool);
    let result = { status: "success", info: "Action performed via SaaS bridge." };
    if (tool.useWebhook && agent.webhookUrl) {
      try {
        const resp = await fetch(agent.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id, tool: fc.name, args: fc.args, incidentId: incident?.id, timestamp: Date.now() })
        });
        if (resp.ok) result = await resp.json();
      } catch (err) { console.error(err); }
    }
    setTimeout(() => setExecutingTool(null), 800);
    return result;
  };

  const startSession = async () => {
    try {
      setError(null);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let systemPrompt = agent.systemInstruction;
      if (incident) systemPrompt += `\n\n[URGENT INCIDENT]: Priority ${incident.priority.toUpperCase()}. Handle "${incident.title}" for ${incident.clientName}. ${incident.description}`;
      
      systemPrompt += `\n\n[ENGINE CONFIG]: You are powered by ${agent.provider} ${agent.modelId}.`;
      
      if (agent.voiceSample) {
        systemPrompt += `\n\n[VOICE CLONE REFERENCE]: A biometric voice sample has been uploaded for this agent. Mimic the tone, pace, and pitch characteristics of that specific audio sample in your output.`;
      }

      // Instruct the AI to ask for confirmation if tools are marked as such
      const sensitiveTools = agent.tools.filter(t => t.requireConfirmation).map(t => t.name);
      if (sensitiveTools.length > 0) {
        systemPrompt += `\n\n[CONFIRMATION RULES]: You MUST verbally ask the user for confirmation before calling any of the following tools: ${sensitiveTools.join(', ')}. Do not call them until the user explicitly agrees.`;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: agent.voice } } },
          systemInstruction: systemPrompt,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: agent.tools.length > 0 ? [{ 
            functionDeclarations: agent.tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters }))
          }] : undefined
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const data = e.inputBuffer.getChannelData(0);
              sessionPromise.then(s => s.sendRealtimeInput({ media: createBlob(data) }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.inputTranscription) transcriptionRef.current.user += msg.serverContent.inputTranscription.text;
            if (msg.serverContent?.outputTranscription) transcriptionRef.current.model += msg.serverContent.outputTranscription.text;
            if (msg.serverContent?.turnComplete) {
              setTranscriptions(prev => [...prev, { role: 'user', text: transcriptionRef.current.user, timestamp: Date.now() }, { role: 'model', text: transcriptionRef.current.model, timestamp: Date.now() }].filter(t => t.text.trim()));
              transcriptionRef.current = { user: '', model: '' };
            }

            const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audio) {
              setIsTalking(true);
              const next = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buf = await decodeAudioData(decode(audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buf;
              source.connect(outputCtx.destination);
              source.addEventListener('ended', () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setIsTalking(false);
              });
              source.start(next);
              nextStartTimeRef.current = next + buf.duration;
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsTalking(false);
            }

            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                const tool = agent.tools.find(t => t.name === fc.name);
                if (tool) {
                  if (tool.requireConfirmation) {
                    // Show UI for manual approval
                    new Promise((resolve) => {
                      setPendingConfirmation({ tool, fc, resolve });
                    }).then(async (userConfirmed) => {
                      setPendingConfirmation(null);
                      if (userConfirmed) {
                        const res = await handleToolExecution(tool, fc);
                        sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: res } }));
                      } else {
                        sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { status: "cancelled", message: "User rejected tool execution." } } }));
                      }
                    });
                  } else {
                    const res = await handleToolExecution(tool, fc);
                    sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: res } }));
                  }
                }
              }
            }
          },
          onclose: () => setIsConnected(false),
          onerror: (e) => { setError("SaaS Bridge Error. Reconnecting..."); stopSession(); }
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) { setError(err.message); }
  };

  useEffect(() => {
    return () => stopSession();
  }, [stopSession]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brain:</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-mono">
                {agent.provider} // {agent.modelId}
              </span>
            </div>
            {agent.voiceSample && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 animate-pulse">
                <i className="fa-solid fa-wave-square text-[8px]"></i> VOICE CLONE ACTIVE
              </div>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-mono tracking-tighter">AES-256 STREAM</div>
        </div>

        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <div>
              <h3 className="font-bold text-lg leading-tight">{agent.name}</h3>
              <div className="text-[10px] text-slate-500 uppercase font-black">{agent.clientName}</div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xl"></i></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative custom-scrollbar">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800 border-2 border-indigo-500 mb-4 relative shadow-2xl">
              {isConnected && <div className="absolute inset-0 bg-indigo-500/10 animate-ping rounded-full" />}
              <i className={`fa-solid ${isConnected ? (isTalking ? 'fa-volume-high' : 'fa-microphone') : 'fa-microphone-slash'} text-4xl text-indigo-400 transition-all`} />
            </div>
            <p className="text-slate-400 text-xs font-medium">{isConnected ? (isTalking ? 'Agent is speaking...' : 'Listening to request...') : 'Ready for dispatch'}</p>
          </div>

          <AudioVisualizer isActive={isConnected} isModelTalking={isTalking} />

          {error && (
            <div className="p-3 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-xs flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i> {error}
            </div>
          )}

          {pendingConfirmation && (
            <div className="p-4 bg-amber-900/20 border border-amber-500/50 rounded-2xl space-y-3 animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest">
                <i className="fa-solid fa-triangle-exclamation"></i> Approval Required
              </div>
              <p className="text-slate-300 text-xs">
                The agent wants to execute <span className="text-white font-mono font-bold">{pendingConfirmation.tool.name}</span> with arguments:
              </p>
              <pre className="bg-slate-950 p-2 rounded-lg text-[10px] font-mono text-emerald-500 overflow-x-auto border border-slate-800">
                {JSON.stringify(pendingConfirmation.fc.args, null, 2)}
              </pre>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => pendingConfirmation.resolve(true)}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-black py-2 rounded-lg transition-all uppercase tracking-widest"
                >
                  Approve Execution
                </button>
                <button 
                  onClick={() => pendingConfirmation.resolve(false)}
                  className="px-4 bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-black py-2 rounded-lg transition-all uppercase tracking-widest"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {executingTool && !pendingConfirmation && (
            <div className="flex justify-center">
              <div className="bg-indigo-600/20 border border-indigo-400/40 rounded-full px-4 py-1.5 flex items-center gap-3 text-[10px] font-black text-indigo-400 animate-bounce">
                <i className="fa-solid fa-plug-circle-bolt"></i> EXECUTING: {executingTool.name.toUpperCase()}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-1">Operational Log</h4>
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {transcriptions.length === 0 && isConnected && (
                <p className="text-slate-600 text-[10px] italic">Speak to begin the interaction...</p>
              )}
              {transcriptions.map((t, i) => (
                <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-4 py-2 rounded-2xl text-xs max-w-[85%] shadow-sm ${t.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'}`}>
                    {t.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-800/50 border-t border-slate-800 flex justify-center backdrop-blur-md">
          <button 
            onClick={isConnected ? stopSession : startSession} 
            className={`px-12 py-3.5 rounded-full font-black shadow-2xl transition-all transform hover:scale-105 active:scale-95 uppercase tracking-widest text-xs ${isConnected ? 'bg-red-600 hover:bg-red-500 shadow-red-500/20' : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'} text-white`}
          >
            {isConnected ? 'Terminate Feed' : 'Establish Link'}
          </button>
        </div>
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { Agent } from '../types';

interface EmbedModalProps {
  agent: Agent;
  onClose: () => void;
}

export const EmbedModal: React.FC<EmbedModalProps> = ({ agent, onClose }) => {
  const [copied, setCopied] = useState(false);

  const embedCode = `<script 
  src="https://voxbuild.ai/v1/widget.js" 
  data-agent-id="${agent.id}" 
  data-client="${agent.clientName}"
  async
></script>`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <i className="fa-solid fa-code text-indigo-400"></i>
              Embed {agent.name}
            </h2>
            <p className="text-xs text-slate-400 mt-1">Deploy this agent to any website or internal dashboard.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">JavaScript Snippet</label>
            <div className="relative group">
              <pre className="bg-slate-950 p-4 rounded-xl text-emerald-400 text-sm font-mono overflow-x-auto border border-slate-800">
                {embedCode}
              </pre>
              <button
                onClick={copyToClipboard}
                className="absolute top-3 right-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold py-1 px-3 rounded-lg transition-all flex items-center gap-2"
              >
                <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-4 flex gap-4">
            <div className="text-indigo-400 mt-1">
              <i className="fa-solid fa-circle-info text-xl"></i>
            </div>
            <div className="text-xs text-slate-300 leading-relaxed">
              <p className="font-bold text-white mb-1">Pro Tip: N8N Automation</p>
              Your agent is configured with <strong>{agent.tools.filter(t => t.useWebhook).length} N8N hooks</strong>. 
              The embedded widget will automatically trigger your N8N workflows when users interact with these tools.
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-800/50 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-semibold transition-all text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

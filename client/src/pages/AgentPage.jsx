import React from 'react';
import { Bot, MessageSquare, Database, Sparkles } from 'lucide-react';

export default function AgentPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#2A2A2A]">
        <div>
          <h1 className="text-xl font-bold tracking-wider uppercase text-white font-mono flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#E10600]" />
            Agent & Long-Term Memory
          </h1>
          <p className="text-xs text-[#888888] mt-1">
            Talk in plain English to build and manage email workflows with persistent memory.
          </p>
        </div>
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] p-12 text-center">
        <Bot className="w-10 h-10 text-[#888888] mx-auto mb-3" />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-1">
          FlowCart Agent Module
        </h3>
        <p className="text-xs text-[#888888] max-w-md mx-auto">
          Agent conversation chat, tool invocation (create_workflow, run_workflow, list_leads, save_memory, search_memory), and memory management interface will be active in Step 6.
        </p>
      </div>
    </div>
  );
}

import React from 'react';
import {
  GitBranch,
  Users,
  Key,
  Activity,
  Bot,
  Settings,
  LogOut,
  Mail,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'workflows', label: 'Workflows', icon: GitBranch },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'credentials', label: 'Credentials', icon: Key },
  { id: 'executions', label: 'Executions', icon: Activity },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeTab, onSelectTab, user, onLogout }) {
  return (
    <aside className="w-64 bg-[#141414] border-r border-[#2A2A2A] h-screen flex flex-col justify-between shrink-0 select-none">
      {/* Top Branding */}
      <div>
        <div className="h-16 px-6 border-b border-[#2A2A2A] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 bg-[#E10600]" />
            <span className="font-bold tracking-wider text-base uppercase text-white font-mono">
              FlowCart
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 border border-[#2A2A2A] text-[#888888]">
            v1.0
          </span>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors text-left ${
                  isActive
                    ? 'bg-[#E10600] text-white font-semibold'
                    : 'text-[#888888] hover:text-white hover:bg-[#0A0A0A]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-[#2A2A2A] bg-[#0A0A0A]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="w-6 h-6 bg-[#2A2A2A] border border-[#2A2A2A] flex items-center justify-center text-[10px] text-white font-mono shrink-0">
              A
            </div>
            <div className="truncate">
              <p className="text-xs font-mono text-white truncate leading-none">
                {user?.email || 'admin@flowcart.local'}
              </p>
              <p className="text-[10px] text-[#888888] font-mono mt-1">Administrator</p>
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-[#2A2A2A] hover:border-[#E10600] hover:text-[#E10600] text-[#888888] text-xs font-mono uppercase tracking-wider transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

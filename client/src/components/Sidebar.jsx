import React from 'react';
import {
  Sparkles,
  Home,
  User,
  Users,
  Key,
  Shield,
  Layers,
  BarChart3,
  HelpCircle,
  Settings,
  Plus,
  Search,
  PanelLeftClose,
  ChevronRight,
  LogOut,
  Clock,
  Activity
} from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab, user, onLogout }) {
  return (
    <aside className="w-60 bg-[#16171b] border-r border-[#22242a] h-screen flex flex-col justify-between shrink-0 select-none text-[#c2c4cf] font-sans text-xs">
      <div>
        {/* Top Trial & Execution Quota Bar */}
        <div className="px-3.5 pt-3 pb-2 text-[11px] text-[#8c90a0] border-b border-[#22242a]/60">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-white font-medium">
              <Clock className="w-3.5 h-3.5 text-[#ff6d5a]" />
              <span>14 days left</span>
            </div>
            <div className="w-16 h-1.5 bg-[#262830] rounded-full overflow-hidden">
              <div className="w-1/3 h-full bg-[#ff6d5a] rounded-full" />
            </div>
          </div>
          <div className="text-[10px] text-[#727582] font-mono">
            0/1000 Executions
          </div>
        </div>

        {/* Brand & Action Header */}
        <div className="px-3.5 py-3 flex items-center justify-between border-b border-[#22242a]">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onSelectTab('workflows')}>
            {/* Authentic n8n logo with nodes */}
            <div className="flex items-center gap-1">
              <svg className="w-6 h-6 text-[#ff6d5a]" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="3" fill="#ff6d5a" />
                <circle cx="12" cy="7" r="3" fill="#ea4b71" />
                <circle cx="19" cy="12" r="3" fill="#ff6d5a" />
                <circle cx="12" cy="17" r="3" fill="#ea4b71" />
                <path d="M7.5 10.5L9.5 8.5M14.5 8.5L16.5 10.5M16.5 13.5L14.5 15.5M9.5 15.5L7.5 13.5" stroke="#ff6d5a" strokeWidth="1.5" />
              </svg>
              <span className="font-bold text-white text-base tracking-tight font-sans">
                n8n
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[#8c90a0]">
            <button
              onClick={() => onSelectTab('workflows')}
              className="p-1 hover:text-white hover:bg-[#22242b] rounded transition-colors"
              title="New workflow"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              className="p-1 hover:text-white hover:bg-[#22242b] rounded transition-colors"
              title="Search"
            >
              <Search className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1 hover:text-white hover:bg-[#22242b] rounded transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="p-2 space-y-0.5">
          {/* Assistant (Agent) */}
          <button
            onClick={() => onSelectTab('agent')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-left ${
              activeTab === 'agent'
                ? 'bg-[#22242b] text-white font-medium'
                : 'text-[#c2c4cf] hover:text-white hover:bg-[#1c1d22]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4 h-4 text-[#ea4b71]" />
              <span>Assistant</span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 bg-[#7d53d6]/25 border border-[#7d53d6]/50 text-[#c4b5fd] rounded font-medium">
              Preview
            </span>
          </button>

          {/* Overview */}
          <button
            onClick={() => onSelectTab('workflows')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left ${
              activeTab === 'overview'
                ? 'bg-[#22242b] text-white font-medium'
                : 'text-[#c2c4cf] hover:text-white hover:bg-[#1c1d22]'
            }`}
          >
            <Home className="w-4 h-4 text-[#8c90a0]" />
            <span>Overview</span>
          </button>

          {/* Personal (Workflows & Canvas) */}
          <button
            onClick={() => onSelectTab('workflows')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left ${
              activeTab === 'workflows'
                ? 'bg-[#22242b] text-white font-medium'
                : 'text-[#c2c4cf] hover:text-white hover:bg-[#1c1d22]'
            }`}
          >
            <User className="w-4 h-4 text-[#ff6d5a]" />
            <span>Personal</span>
          </button>

          {/* Leads */}
          <button
            onClick={() => onSelectTab('leads')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left ${
              activeTab === 'leads'
                ? 'bg-[#22242b] text-white font-medium'
                : 'text-[#c2c4cf] hover:text-white hover:bg-[#1c1d22]'
            }`}
          >
            <Users className="w-4 h-4 text-[#8c90a0]" />
            <span>Leads</span>
          </button>

          {/* Credentials */}
          <button
            onClick={() => onSelectTab('credentials')}
            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left ${
              activeTab === 'credentials'
                ? 'bg-[#22242b] text-white font-medium'
                : 'text-[#c2c4cf] hover:text-white hover:bg-[#1c1d22]'
            }`}
          >
            <Key className="w-4 h-4 text-[#8c90a0]" />
            <span>Credentials</span>
          </button>
        </nav>
      </div>

      {/* Secondary Bottom Navigation */}
      <div className="p-2 border-t border-[#22242a] space-y-0.5">
        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left ${
            activeTab === 'admin'
              ? 'bg-[#22242b] text-white font-medium'
              : 'text-[#8c90a0] hover:text-white hover:bg-[#1c1d22]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Admin Panel</span>
        </button>

        <button
          onClick={() => onSelectTab('workflows')}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left text-[#8c90a0] hover:text-white hover:bg-[#1c1d22]"
        >
          <Layers className="w-4 h-4" />
          <span>Templates</span>
        </button>

        <button
          onClick={() => onSelectTab('executions')}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-colors text-left ${
            activeTab === 'executions'
              ? 'bg-[#22242b] text-white font-medium'
              : 'text-[#8c90a0] hover:text-white hover:bg-[#1c1d22]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Insights</span>
        </button>

        <button
          onClick={() => onSelectTab('agent')}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-left text-[#8c90a0] hover:text-white hover:bg-[#1c1d22]"
        >
          <div className="flex items-center gap-2.5">
            <HelpCircle className="w-4 h-4" />
            <span>Help</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#555866]" />
        </button>

        <button
          onClick={() => onSelectTab('settings')}
          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-colors text-left ${
            activeTab === 'settings'
              ? 'bg-[#22242b] text-white font-medium'
              : 'text-[#8c90a0] hover:text-white hover:bg-[#1c1d22]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4" />
            <span>Settings</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#555866]" />
        </button>

        {/* User profile & logout */}
        <div className="pt-2 mt-2 border-t border-[#22242a] flex items-center justify-between px-2 text-[11px]">
          <div className="flex items-center gap-2 truncate">
            <div className="w-5 h-5 rounded-full bg-[#ff6d5a] flex items-center justify-center text-white font-bold text-[10px]">
              {user?.email ? user.email.slice(0, 1).toUpperCase() : 'A'}
            </div>
            <span className="truncate text-[#c2c4cf]">{user?.email || 'admin@flowcart.local'}</span>
          </div>
          <button
            onClick={onLogout}
            className="p-1 hover:text-[#ff6d5a] text-[#727582]"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

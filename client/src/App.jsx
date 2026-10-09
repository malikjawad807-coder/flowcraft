import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import LoginPage from './components/LoginPage.jsx';
import WorkflowsPage from './pages/WorkflowsPage.jsx';
import LeadsPage from './pages/LeadsPage.jsx';
import CredentialsPage from './pages/CredentialsPage.jsx';
import ExecutionsPage from './pages/ExecutionsPage.jsx';
import AgentPage from './pages/AgentPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('workflows');
  const [activeWorkflowId, setActiveWorkflowId] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      setCheckingAuth(true);
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-xs font-mono text-[#888888] gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#E10600]" />
        <span>Initializing FlowCart...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="flex h-screen w-full bg-[#0A0A0A] text-white font-sans overflow-hidden">
      {/* Fixed Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setActiveWorkflowId(null);
        }}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content View */}
      <main className="flex-1 h-screen overflow-y-auto bg-[#0A0A0A]">
        {activeTab === 'workflows' && (
          <WorkflowsPage onOpenEditor={(id) => setActiveWorkflowId(id)} />
        )}
        {activeTab === 'leads' && <LeadsPage />}
        {activeTab === 'credentials' && <CredentialsPage />}
        {activeTab === 'executions' && <ExecutionsPage />}
        {activeTab === 'agent' && <AgentPage />}
        {activeTab === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

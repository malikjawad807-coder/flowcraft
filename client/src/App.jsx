import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import LoginPage from './components/LoginPage.jsx';
import WorkflowsPage from './pages/WorkflowsPage.jsx';
import EditorPage from './pages/EditorPage.jsx';
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
  // Default to 'new' so it opens the exact n8n canvas view from the screenshot
  const [activeWorkflowId, setActiveWorkflowId] = useState('new');

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
      <div className="min-h-screen bg-[#101114] flex items-center justify-center text-xs font-mono text-[#8c90a0] gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#ff6d5a]" />
        <span>Initializing FlowCart...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="flex h-screen w-full bg-[#101114] text-white font-sans overflow-hidden">
      {/* Fixed Authentic n8n Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'workflows') {
            setActiveWorkflowId('new');
          } else {
            setActiveWorkflowId(null);
          }
        }}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content View (Canvas Editor or specific management page) */}
      <main className="flex-1 h-screen overflow-hidden bg-[#101114]">
        {activeTab === 'workflows' && (
          activeWorkflowId ? (
            <EditorPage
              workflowId={activeWorkflowId}
              onBack={() => setActiveWorkflowId(null)}
            />
          ) : (
            <div className="h-screen overflow-y-auto">
              <WorkflowsPage onOpenEditor={(id) => setActiveWorkflowId(id)} />
            </div>
          )
        )}
        {activeTab === 'leads' && (
          <div className="h-screen overflow-y-auto">
            <LeadsPage />
          </div>
        )}
        {activeTab === 'credentials' && (
          <div className="h-screen overflow-y-auto">
            <CredentialsPage />
          </div>
        )}
        {activeTab === 'executions' && (
          <div className="h-screen overflow-y-auto">
            <ExecutionsPage />
          </div>
        )}
        {activeTab === 'agent' && (
          <div className="h-screen overflow-y-auto">
            <AgentPage />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="h-screen overflow-y-auto">
            <SettingsPage />
          </div>
        )}
      </main>
    </div>
  );
}

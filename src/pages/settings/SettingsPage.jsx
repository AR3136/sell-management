import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import './SettingsPage.css';

export default function SettingsPage() {
  const { user } = useAuth();

  // -- LocalStorage Helpers for Settings --
  const loadSettings = (key, defaultVal) => {
    try {
      const saved = localStorage.getItem(`cop_settings_${key}`);
      return saved ? JSON.parse(saved) : defaultVal;
    } catch {
      // Corrupted JSON in localStorage — return default safely
      console.warn(`Settings key "${key}" had corrupted data. Resetting to defaults.`);
      return defaultVal;
    }
  };
  
  const saveSettings = (key, val) => {
    localStorage.setItem(`cop_settings_${key}`, JSON.stringify(val));
  };

  // -- Data States --
  const [companyInfo, setCompanyInfo] = useState(() => loadSettings('company', {
    name: 'COP Operations Ltd',
    logo: 'logo_cop.svg',
    address: '404 Industrial Sector, Phase 1, Corporate Hub',
    phone: '+1 555-0000',
    email: 'ops@company.com',
    website: 'www.companyportal.com',
    gst: '27AAAAA1111A1Z1',
    pan: 'ABCDE1234F',
  }));

  const [businessSettings, setBusinessSettings] = useState(() => loadSettings('business', {
    financialYear: 'Apr - Mar',
    currency: 'USD',
    paymentTerms: 'Milestone-based (3 Parts)',
  }));

  const [templates, setTemplates] = useState(() => loadSettings('templates', {
    quotation: 'Standard Industrial Layout v3.1',
    invoice: 'GST Compliant Invoice Template v1.0',
    email: 'Dear {client_name},\n\nWe have updated your requirement scope status for project "{project_name}" to: {status}.\n\nRegards,\nOperations Team',
  }));

  const [notifications, setNotifications] = useState(() => loadSettings('notifications', {
    email: true,
    whatsapp: true,
    sms: false,
  }));

  const [userPrefs, setUserPrefs] = useState(() => loadSettings('prefs', {
    darkMode: false,
    denseTables: true,
    sidebarPlacement: 'left',
  }));

  // -- Audit Logs List --
  const [auditLogs] = useState([
    { id: 'LOG-01', timestamp: '2026-07-02 04:30 PM', employee: 'Admin User', action: 'Modified Employee John Doe authorization limits' },
    { id: 'LOG-02', timestamp: '2026-07-02 02:45 PM', employee: 'Jane Smith', action: 'Approved Requirement REQ-203 stage to Ready for Manufacturer' },
    { id: 'LOG-03', timestamp: '2026-07-01 10:15 AM', employee: 'John Doe', action: 'Logged Call touchpoint for Acme Corporation' },
    { id: 'LOG-04', timestamp: '2026-06-30 01:20 PM', employee: 'Admin User', action: 'Updated default base currency from EUR to USD' },
  ]);

  // -- Tab Control --
  const [activeSubTab, setActiveSubTab] = useState('company'); // 'company' | 'business' | 'templates' | 'system' | 'logs'

  // Only Administrator role has access — do NOT include !user (unauthenticated bypass)
  const isAuthorized = user?.role === 'Administrator' || user?.role === 'admin';

  if (!isAuthorized) {
    return (
      <div className="module-page">
        <div className="module-page__header">
          <h1 className="module-page__title">Restricted Access</h1>
        </div>
        <Card padding="lg" className="flex flex-col items-center justify-center text-center gap-4">
          <span className="material-icons text-danger" style={{ fontSize: '64px' }}>gavel</span>
          <h2 className="font-bold color-primary">Unauthorized Access</h2>
          <p className="text-muted" style={{ maxWidth: '460px' }}>
            Only users with **Administrator** role templates are authorized to modify portal configs, branding, business variables, or inspect system audit trails.
          </p>
        </Card>
      </div>
    );
  }

  const handleSaveCompany = (e) => {
    e.preventDefault();
    saveSettings('company', companyInfo);
    alert('Note: A settings table is missing in Supabase schema. Company configurations saved to local storage for now.');
  };

  const handleSaveBusiness = (e) => {
    e.preventDefault();
    saveSettings('business', businessSettings);
    saveSettings('notifications', notifications);
    saveSettings('prefs', userPrefs);
    alert('Note: A settings table is missing in Supabase schema. Business parameters saved to local storage for now.');
  };

  const handleSaveTemplates = (e) => {
    e.preventDefault();
    saveSettings('templates', templates);
    alert('Note: A settings table is missing in Supabase schema. Templates saved to local storage for now.');
  };

  const handleBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ companyInfo, businessSettings, templates, notifications }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "cop_backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleRestore = () => {
    alert('Mock Restore System: Please upload a valid JSON backup schema file to restore portal parameters.');
  };

  return (
    <div className="module-page">
      {/* Header */}
      <div className="module-page__header">
        <h1 className="module-page__title">Portal Configurations</h1>
        <p className="module-page__subtitle">Control organizational preferences, backup trails, and system audit logs.</p>
      </div>

      {/* Settings SubTabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeSubTab === 'company' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveSubTab('company')}
        >
          Company Information
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'business' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveSubTab('business')}
        >
          Business & Notifications
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'templates' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveSubTab('templates')}
        >
          Doc Templates
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'system' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveSubTab('system')}
        >
          System & Backup
        </button>
        <button
          className={`tab-btn ${activeSubTab === 'logs' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveSubTab('logs')}
        >
          Audit Logs
        </button>
      </div>

      {/* SubTab Content */}
      <div className="settings-page-content">
        {activeSubTab === 'company' && (
          <Card padding="lg">
            <h2 className="settings-card__title">Organization Settings</h2>
            <form onSubmit={handleSaveCompany} className="dashboard-modal-form" style={{ marginTop: 'var(--space-4)' }}>
              <div className="form-grid-2">
                <Input
                  id="set-co-name"
                  label="Company Name *"
                  value={companyInfo.name}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                  required
                />
                <Input
                  id="set-co-logo"
                  label="Logo File Name"
                  value={companyInfo.logo}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, logo: e.target.value })}
                />
                <Input
                  id="set-co-phone"
                  label="Company Phone Number"
                  value={companyInfo.phone}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                />
                <Input
                  id="set-co-email"
                  type="email"
                  label="Company Email"
                  value={companyInfo.email}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                />
                <Input
                  id="set-co-web"
                  label="Company Website"
                  value={companyInfo.website}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                />
                <Input
                  id="set-co-gst"
                  label="GST Identification"
                  value={companyInfo.gst}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, gst: e.target.value })}
                />
                <Input
                  id="set-co-pan"
                  label="PAN Registry Number"
                  value={companyInfo.pan}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, pan: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="input-field__label" htmlFor="set-co-addr">Registered Address</label>
                <textarea
                  id="set-co-addr"
                  className="dashboard-textarea"
                  rows="3"
                  value={companyInfo.address}
                  onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                />
              </div>
              <div>
                <Button type="submit" variant="primary">
                  Save General Settings
                </Button>
              </div>
            </form>
          </Card>
        )}

        {activeSubTab === 'business' && (
          <div className="flex flex-col gap-6">
            {/* Financial Parameters */}
            <Card padding="lg">
              <h2 className="settings-card__title">Billing & Financial Settings</h2>
              <form onSubmit={handleSaveBusiness} className="dashboard-modal-form" style={{ marginTop: 'var(--space-4)' }}>
                <div className="form-grid-3">
                  <div className="form-group">
                    <label className="input-field__label" htmlFor="set-fy">Financial Year Cycle</label>
                    <select
                      id="set-fy"
                      className="dashboard-select"
                      value={businessSettings.financialYear}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, financialYear: e.target.value })}
                    >
                      <option value="Apr - Mar">Apr - Mar (Standard)</option>
                      <option value="Jan - Dec">Jan - Dec (Calendar)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="input-field__label" htmlFor="set-currency">Default Currency</label>
                    <select
                      id="set-currency"
                      className="dashboard-select"
                      value={businessSettings.currency}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, currency: e.target.value })}
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="INR">INR (₹)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="input-field__label" htmlFor="set-terms">Default Billing Terms</label>
                    <select
                      id="set-terms"
                      className="dashboard-select"
                      value={businessSettings.paymentTerms}
                      onChange={(e) => setBusinessSettings({ ...businessSettings, paymentTerms: e.target.value })}
                    >
                      <option value="100% Upfront">100% Upfront</option>
                      <option value="Milestone-based (3 Parts)">Milestone-based (3 Parts)</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 60">Net 60</option>
                    </select>
                  </div>
                </div>

                <div className="dropdown-divider" />

                {/* Notifications */}
                <h3 className="settings-card__title" style={{ border: 'none', padding: 0 }}>Notification Dispatch Parameters</h3>
                <div className="flex gap-6 flex-wrap" style={{ marginTop: 'var(--space-2)' }}>
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={notifications.email}
                      onChange={(e) => setNotifications({ ...notifications, email: e.target.checked })}
                    />
                    Enable Email Dispatches
                  </label>
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={notifications.whatsapp}
                      onChange={(e) => setNotifications({ ...notifications, whatsapp: e.target.checked })}
                    />
                    Enable WhatsApp API
                  </label>
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={notifications.sms}
                      onChange={(e) => setNotifications({ ...notifications, sms: e.target.checked })}
                    />
                    Enable Carrier SMS
                  </label>
                </div>

                <div className="dropdown-divider" />

                {/* Preferences */}
                <h3 className="settings-card__title" style={{ border: 'none', padding: 0 }}>Portal Layout Preferences</h3>
                <div className="flex gap-6 flex-wrap" style={{ marginTop: 'var(--space-2)' }}>
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={userPrefs.darkMode}
                      onChange={(e) => setUserPrefs({ ...userPrefs, darkMode: e.target.checked })}
                    />
                    Visual Dark Mode
                  </label>
                  <label className="flex items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      checked={userPrefs.denseTables}
                      onChange={(e) => setUserPrefs({ ...userPrefs, denseTables: e.target.checked })}
                    />
                    Compact Table Density
                  </label>
                </div>

                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Button type="submit" variant="primary">
                    Save Configs
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {activeSubTab === 'templates' && (
          <Card padding="lg">
            <h2 className="settings-card__title">Document & Email Layout Templates</h2>
            <form onSubmit={handleSaveTemplates} className="dashboard-modal-form" style={{ marginTop: 'var(--space-4)' }}>
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="input-field__label" htmlFor="temp-quote">Quotation Template Selector</label>
                  <select
                    id="temp-quote"
                    className="dashboard-select"
                    value={templates.quotation}
                    onChange={(e) => setTemplates({ ...templates, quotation: e.target.value })}
                  >
                    <option value="Standard Industrial Layout v3.1">Standard Industrial Layout v3.1</option>
                    <option value="Minimalist Quote Blueprint">Minimalist Quote Blueprint</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="input-field__label" htmlFor="temp-inv">Invoice Template Selector</label>
                  <select
                    id="temp-inv"
                    className="dashboard-select"
                    value={templates.invoice}
                    onChange={(e) => setTemplates({ ...templates, invoice: e.target.value })}
                  >
                    <option value="GST Compliant Invoice Template v1.0">GST Compliant Invoice Template v1.0</option>
                    <option value="International Billing Standard">International Billing Standard</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="input-field__label" htmlFor="temp-email">Notification Email Template (Plain Text)</label>
                <textarea
                  id="temp-email"
                  className="dashboard-textarea"
                  rows="5"
                  value={templates.email}
                  onChange={(e) => setTemplates({ ...templates, email: e.target.value })}
                />
              </div>
              <div>
                <Button type="submit" variant="primary">
                  Save Layout Templates
                </Button>
              </div>
            </form>
          </Card>
        )}

        {activeSubTab === 'system' && (
          <Card padding="lg" className="flex flex-col gap-6">
            <div>
              <h2 className="settings-card__title">System Utilities & Backups</h2>
              <p className="text-sm text-muted" style={{ marginTop: 'var(--space-1)' }}>
                Maintain backup snapshots of configuration files, templates, and portal details.
              </p>
            </div>

            <div className="flex gap-4 flex-wrap">
              <Button variant="secondary" icon="cloud_download" onClick={handleBackup}>
                Backup Configurations
              </Button>
              <Button variant="outline" icon="cloud_upload" onClick={handleRestore}>
                Restore System Backup
              </Button>
            </div>
          </Card>
        )}

        {activeSubTab === 'logs' && (
          <Card padding="lg" className="flex flex-col gap-4">
            <h2 className="settings-card__title">Portal System Audit Trail</h2>
            <div className="audit-timeline" style={{ marginTop: 'var(--space-2)' }}>
              {auditLogs.map((log) => (
                <div key={log.id} className="audit-log-node flex flex-col gap-1 text-sm">
                  <div className="flex justify-between items-center flex-wrap">
                    <span className="font-semibold text-primary">{log.employee}</span>
                    <span className="text-xs text-muted">{log.timestamp}</span>
                  </div>
                  <p className="text-muted" style={{ margin: 0 }}>{log.action}</p>
                  <span className="text-xs text-muted">ID: {log.id}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

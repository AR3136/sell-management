import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabaseClient';
import WelcomeBanner from '../../components/dashboard/WelcomeBanner';
import StatCard from '../../components/dashboard/StatCard';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Badge from '../../components/common/Badge';
import './DashboardPage.css';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // -- Modals state --
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [followupModalOpen, setFollowupModalOpen] = useState(false);

  // -- Form inputs --
  const [leadForm, setLeadForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    industry: 'Manufacturing',
    approachType: 'We Approached Them',
    modeOfApproach: 'Website'
  });
  const [reqForm, setReqForm] = useState({ title: '', companyId: '', budget: '', urgency: 'Medium', description: '' });
  const [followupForm, setFollowupForm] = useState({ companyId: '', date: '', time: '', notes: '', type: 'Phone' });

  // -- Database State --
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState({
    totalLeads: 0,
    activeRequirements: 0,
    ordersInProgress: 0,
    completedOrders: 0,
    pendingPayments: 0,
    upcomingFollowups: 0,
  });
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    // 1. Fetch Companies list for dropdowns
    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
    if (companiesData) setCompanies(companiesData);

    // 2. Fetch stats
    const { count: companyCount } = await supabase.from('companies').select('*', { count: 'exact', head: true });
    const { count: reqCount } = await supabase.from('requirements').select('*', { count: 'exact', head: true });
    const { count: progressCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).lt('current_step_index', 6);
    const { count: completedCount } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('current_step_index', 6);
    const { count: paymentCount } = await supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'Pending');
    const { count: followUpCount } = await supabase.from('communications').select('*', { count: 'exact', head: true }).not('follow_up_date', 'is', null);

    setStats({
      totalLeads: companyCount || 0,
      activeRequirements: reqCount || 0,
      ordersInProgress: progressCount || 0,
      completedOrders: completedCount || 0,
      pendingPayments: paymentCount || 0,
      upcomingFollowups: followUpCount || 0,
    });

    // 3. Fetch real activities (recent communications, companies, and requirements)
    const { data: recentComm } = await supabase
      .from('communications')
      .select('id, type, summary, created_at, companies(name)')
      .order('created_at', { ascending: false })
      .limit(3);

    const { data: recentReq } = await supabase
      .from('requirements')
      .select('id, title, created_at, companies(name)')
      .order('created_at', { ascending: false })
      .limit(2);

    const { data: recentCompanies } = await supabase
      .from('companies')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(2);

    const formattedActivities = [];

    if (recentCompanies) {
      recentCompanies.forEach(c => {
        formattedActivities.push({
          id: c.id,
          user: 'Sales team',
          type: 'Lead Created',
          detail: `New Lead: ${c.name}`,
          time: new Date(c.created_at).toLocaleDateString(),
          icon: 'person_add',
          color: 'primary',
          rawTime: new Date(c.created_at).getTime()
        });
      });
    }

    if (recentReq) {
      recentReq.forEach(r => {
        formattedActivities.push({
          id: r.id,
          user: 'Client Desk',
          type: 'Requirement Added',
          detail: `Requirement "${r.title}" for ${r.companies?.name || 'Unknown'}`,
          time: new Date(r.created_at).toLocaleDateString(),
          icon: 'assignment',
          color: 'info',
          rawTime: new Date(r.created_at).getTime()
        });
      });
    }

    if (recentComm) {
      recentComm.forEach(c => {
        formattedActivities.push({
          id: c.id,
          user: 'Sales Agent',
          type: 'Interaction Logged',
          detail: `${c.type} with ${c.companies?.name || 'Unknown'} - "${c.summary}"`,
          time: new Date(c.created_at).toLocaleDateString(),
          icon: 'chat',
          color: 'warning',
          rawTime: new Date(c.created_at).getTime()
        });
      });
    }

    // Sort combined activities by time descending
    formattedActivities.sort((a, b) => b.rawTime - a.rawTime);
    setActivities(formattedActivities.slice(0, 5));
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();

    const dbPayload = {
      name: leadForm.name,
      contact_person: leadForm.contactPerson || 'Contact Person',
      phone: leadForm.phone || 'N/A',
      email: leadForm.email,
      industry: leadForm.industry,
      approach_type: leadForm.approachType,
      mode_of_approach: leadForm.modeOfApproach,
    };

    const { error } = await supabase
      .from('companies')
      .insert([dbPayload]);

    if (error) {
      console.error('Error inserting lead:', error);
      alert('Failed to save lead: ' + error.message);
    } else {
      fetchDashboardData();
      setLeadModalOpen(false);
      setLeadForm({
        name: '',
        contactPerson: '',
        email: '',
        phone: '',
        industry: 'Manufacturing',
        approachType: 'We Approached Them',
        modeOfApproach: 'Website'
      });
    }
  };

  const handleReqSubmit = async (e) => {
    e.preventDefault();

    const dbPayload = {
      company_id: reqForm.companyId,
      title: reqForm.title,
      meeting_type: 'Online',
      description: reqForm.description || 'Quick requirement log from Dashboard.',
      urgency: reqForm.urgency,
      expected_budget: reqForm.budget,
      status: 'Draft',
    };

    const { error } = await supabase
      .from('requirements')
      .insert([dbPayload]);

    if (error) {
      console.error('Error inserting requirement:', error);
      alert('Failed to save requirement: ' + error.message);
    } else {
      fetchDashboardData();
      setReqModalOpen(false);
      setReqForm({ title: '', companyId: '', budget: '', urgency: 'Medium', description: '' });
    }
  };

  const handleFollowupSubmit = async (e) => {
    e.preventDefault();

    const dbPayload = {
      company_id: followupForm.companyId,
      type: followupForm.type,
      time: followupForm.time,
      summary: followupForm.notes || 'Follow-up touches logged.',
      status: 'In Discussion',
      follow_up_date: followupForm.date || null,
    };

    const { error } = await supabase
      .from('communications')
      .insert([dbPayload]);

    if (error) {
      console.error('Error scheduling follow-up:', error);
      alert('Failed to schedule follow-up: ' + error.message);
    } else {
      fetchDashboardData();
      setFollowupModalOpen(false);
      setFollowupForm({ companyId: '', date: '', time: '', notes: '', type: 'Phone' });
    }
  };

  // -- Grid widget datasets --
  const widgetsData = [
    { title: 'Total Leads', value: stats.totalLeads.toString(), icon: 'person_add', trend: 'Total count', trendDirection: 'neutral', color: 'primary' },
    { title: 'Active Requirements', value: stats.activeRequirements.toString(), icon: 'assignment', trend: 'Customer specs', trendDirection: 'neutral', color: 'info' },
    { title: 'Orders in Progress', value: stats.ordersInProgress.toString(), icon: 'precision_manufacturing', trend: 'Active manufacturer stages', trendDirection: 'neutral', color: 'primary' },
    { title: 'Completed Orders', value: stats.completedOrders.toString(), icon: 'check_circle', trend: 'Finalized orders', trendDirection: 'neutral', color: 'success' },
    { title: 'Pending Payments', value: stats.pendingPayments.toString(), icon: 'payments', trend: 'Unpaid billing cycles', trendDirection: 'neutral', color: 'danger' },
    { title: 'Upcoming Follow-ups', value: stats.upcomingFollowups.toString(), icon: 'schedule', trend: 'Tasks scheduled', trendDirection: 'neutral', color: 'warning' },
  ];

  return (
    <div className="dashboard-page">
      {/* Quick Actions Panel */}
      <Card padding="md" className="quick-actions-card">
        <h3 className="quick-actions-card__title" style={{ marginBottom: 'var(--space-2)' }}>Quick Actions</h3>
        <div className="quick-actions-buttons flex gap-3 flex-wrap">
          <Button variant="primary" icon="person_add" onClick={() => setLeadModalOpen(true)}>
            Add New Lead
          </Button>
          <Button variant="secondary" icon="assignment" onClick={() => setReqModalOpen(true)}>
            Add Requirement
          </Button>
          <Button variant="outline" icon="schedule" onClick={() => setFollowupModalOpen(true)}>
            Schedule Follow-up
          </Button>
        </div>
      </Card>

      {/* Stats Widgets Grid */}
      <section className="dashboard-grid">
        {widgetsData.map((widget, i) => (
          <StatCard
            key={i}
            title={widget.title}
            value={widget.value}
            icon={widget.icon}
            trend={widget.trend}
            trendDirection={widget.trendDirection}
            color={widget.color}
          />
        ))}
      </section>

      {/* Main Dash Charts & Activities Grid */}
      <div className="dashboard-layouts-grid">
        {/* Left Section: Charts & Quick Actions */}
        <div className="dashboard-left-col">
          {/* Charts Row */}
          <div className="charts-grid">
            {/* Monthly Leads Bar Chart */}
            <Card padding="md" className="chart-card">
              <div className="chart-card__header">
                <span className="chart-card__title">Monthly Leads Graph</span>
                <Badge variant="primary">Last 6 Months</Badge>
              </div>
              <div className="chart-card__body">
                <div className="bar-chart">
                  <div className="bar-chart__bar-wrapper">
                    <div className="bar-chart__bar" style={{ height: '40%' }}><span className="bar-chart__val">40</span></div>
                    <span className="bar-chart__label">Jan</span>
                  </div>
                  <div className="bar-chart__bar-wrapper">
                    <div className="bar-chart__bar" style={{ height: '60%' }}><span className="bar-chart__val">60</span></div>
                    <span className="bar-chart__label">Feb</span>
                  </div>
                  <div className="bar-chart__bar-wrapper">
                    <div className="bar-chart__bar" style={{ height: '50%' }}><span className="bar-chart__val">50</span></div>
                    <span className="bar-chart__label">Mar</span>
                  </div>
                  <div className="bar-chart__bar-wrapper">
                    <div className="bar-chart__bar" style={{ height: '80%' }}><span className="bar-chart__val">80</span></div>
                    <span className="bar-chart__label">Apr</span>
                  </div>
                  <div className="bar-chart__bar-wrapper">
                    <div className="bar-chart__bar" style={{ height: '65%' }}><span className="bar-chart__val">65</span></div>
                    <span className="bar-chart__label">May</span>
                  </div>
                  <div className="bar-chart__bar-wrapper">
                    <div className="bar-chart__bar bar-chart__bar--active" style={{ height: '90%' }}><span className="bar-chart__val">90</span></div>
                    <span className="bar-chart__label">Jun</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Monthly Orders Line Chart Visual */}
            <Card padding="md" className="chart-card">
              <div className="chart-card__header">
                <span className="chart-card__title">Monthly Orders</span>
                <Badge variant="success">Completed</Badge>
              </div>
              <div className="chart-card__body justify-center items-center">
                <svg className="sparkline" viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-success)" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="var(--color-success)" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path
                    fill="url(#sparkline-grad)"
                    stroke="none"
                    d="M 0 30 L 0 25 L 20 20 L 40 28 L 60 15 L 80 18 L 100 8 L 100 30 Z"
                  />
                  <path
                    fill="none"
                    stroke="var(--color-success)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M 0 25 L 20 20 L 40 28 L 60 15 L 80 18 L 100 8"
                  />
                </svg>
                <div className="sparkline-stats flex justify-between w-full">
                  <span className="text-sm font-semibold">Jan: 12 orders</span>
                  <span className="text-sm font-bold text-success">Jun: 48 orders</span>
                </div>
              </div>
            </Card>

            {/* Revenue Trend Visual */}
            <Card padding="md" className="chart-card">
              <div className="chart-card__header">
                <span className="chart-card__title">Revenue Trend</span>
                <span className="text-sm font-semibold text-muted">H1 Trend</span>
              </div>
              <div className="chart-card__body">
                <div className="trend-bars">
                  <div className="trend-bar-row">
                    <span className="trend-bar-row__label">Q1 Target</span>
                    <div className="trend-bar-row__track">
                      <div className="trend-bar-row__fill" style={{ width: '85%', backgroundColor: 'var(--color-accent)' }} />
                    </div>
                    <span className="trend-bar-row__pct">85%</span>
                  </div>
                  <div className="trend-bar-row">
                    <span className="trend-bar-row__label">Q2 Target</span>
                    <div className="trend-bar-row__track">
                      <div className="trend-bar-row__fill" style={{ width: '92%', backgroundColor: 'var(--color-success)' }} />
                    </div>
                    <span className="trend-bar-row__pct">92%</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Lead Conversion Progress */}
            <Card padding="md" className="chart-card">
              <div className="chart-card__header">
                <span className="chart-card__title">Lead Conversion</span>
                <Badge variant="warning">Avg 65%</Badge>
              </div>
              <div className="chart-card__body justify-center items-center gap-2">
                <div className="gauge-container">
                  <svg className="gauge-svg" viewBox="0 0 36 36">
                    <path
                      className="gauge-bg-ring"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    <path
                      className="gauge-fill-ring"
                      strokeDasharray="65, 100"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                  </svg>
                  <div className="gauge-inner-val">65%</div>
                </div>
                <span className="text-sm text-muted">Conversion rate from Lead to Requirement</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Right Section: Recent Activities & Notifications */}
        <aside className="dashboard-right-col">
          <Card padding="md" className="activities-card">
            <h3 className="activities-card__title">Recent Activity Timeline</h3>
            <div className="timeline">
              {activities.map((act) => (
                <div className="timeline-item" key={act.id}>
                  <div className={`timeline-item__badge timeline-item__badge--${act.color}`}>
                    <span className="material-icons">{act.icon}</span>
                  </div>
                  <div className="timeline-item__content">
                    <span className="timeline-item__type font-semibold">{act.type}</span>
                    <p className="timeline-item__detail text-sm text-muted">{act.detail}</p>
                    <span className="timeline-item__time text-xs">{act.time} &bull; by {act.user}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      {/* --- Add Lead Modal --- */}
      <Modal
        isOpen={leadModalOpen}
        onClose={() => setLeadModalOpen(false)}
        title="Add New Lead"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLeadModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="lead-form">Create Lead</Button>
          </>
        }
      >
        <form id="lead-form" onSubmit={handleLeadSubmit} className="dashboard-modal-form">
          <div className="form-grid-2">
            <Input
              id="lead-name"
              label="Client/Company Name *"
              placeholder="Acme Corporation"
              value={leadForm.name}
              onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
              required
            />
            <Input
              id="lead-contact"
              label="Contact Person Name *"
              placeholder="John Doe"
              value={leadForm.contactPerson}
              onChange={(e) => setLeadForm({ ...leadForm, contactPerson: e.target.value })}
              required
            />
            <Input
              id="lead-email"
              type="email"
              label="Email Address *"
              placeholder="contact@acme.com"
              value={leadForm.email}
              onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
              required
            />
            <Input
              id="lead-phone"
              type="tel"
              label="Phone Number"
              placeholder="+1 555-0199"
              value={leadForm.phone}
              onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })}
            />
            <div className="form-group">
              <label className="input-field__label" htmlFor="lead-industry">Industry Segment</label>
              <select
                id="lead-industry"
                className="dashboard-select"
                value={leadForm.industry}
                onChange={(e) => setLeadForm({ ...leadForm, industry: e.target.value })}
              >
                <option value="Manufacturing">Manufacturing</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Logistics">Logistics</option>
                <option value="Retail">Retail</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Finance">Finance</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-field__label" htmlFor="lead-approach">Approach Type *</label>
              <select
                id="lead-approach"
                className="dashboard-select"
                value={leadForm.approachType}
                onChange={(e) => setLeadForm({ ...leadForm, approachType: e.target.value })}
                required
              >
                <option value="We Approached Them">We Approached Them</option>
                <option value="They Approached Us">They Approached Us</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-field__label" htmlFor="lead-mode">Mode of Approach</label>
              <select
                id="lead-mode"
                className="dashboard-select"
                value={leadForm.modeOfApproach}
                onChange={(e) => setLeadForm({ ...leadForm, modeOfApproach: e.target.value })}
              >
                <option value="Website">Website</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Exhibition">Exhibition</option>
                <option value="Reference">Reference</option>
                <option value="Cold Call">Cold Call</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Phone">Phone</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* --- Add Requirement Modal --- */}
      <Modal
        isOpen={reqModalOpen}
        onClose={() => setReqModalOpen(false)}
        title="Add Client Requirement"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReqModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="req-form">Submit Requirement</Button>
          </>
        }
      >
        <form id="req-form" onSubmit={handleReqSubmit} className="dashboard-modal-form">
          <Input
            id="req-title"
            label="Requirement Title *"
            placeholder="CRM Platform Customization"
            value={reqForm.title}
            onChange={(e) => setReqForm({ ...reqForm, title: e.target.value })}
            required
          />
          <div className="form-group">
            <label className="input-field__label" htmlFor="req-client-select">Client Company *</label>
            <select
              id="req-client-select"
              className="dashboard-select"
              value={reqForm.companyId}
              onChange={(e) => setReqForm({ ...reqForm, companyId: e.target.value })}
              required
            >
              <option value="">-- Select Client --</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input
            id="req-budget"
            label="Estimated Budget ($) *"
            placeholder="15000"
            value={reqForm.budget}
            onChange={(e) => setReqForm({ ...reqForm, budget: e.target.value })}
            required
          />
          <div className="form-group">
            <label className="input-field__label" htmlFor="req-desc">Requirement Description</label>
            <textarea
              id="req-desc"
              className="dashboard-textarea"
              placeholder="Provide a short specification of the requirement..."
              rows="3"
              value={reqForm.description}
              onChange={(e) => setReqForm({ ...reqForm, description: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="input-field__label" htmlFor="req-urgency">Urgency Level</label>
            <select
              id="req-urgency"
              className="dashboard-select"
              value={reqForm.urgency}
              onChange={(e) => setReqForm({ ...reqForm, urgency: e.target.value })}
            >
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="High">High Priority</option>
              <option value="Critical">Critical Priority</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* --- Schedule Follow-up Modal --- */}
      <Modal
        isOpen={followupModalOpen}
        onClose={() => setFollowupModalOpen(false)}
        title="Schedule Follow-up"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFollowupModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="followup-form">Schedule</Button>
          </>
        }
      >
        <form id="followup-form" onSubmit={handleFollowupSubmit} className="dashboard-modal-form">
          <div className="form-group">
            <label className="input-field__label" htmlFor="followup-client-select">Client/Prospect Name *</label>
            <select
              id="followup-client-select"
              className="dashboard-select"
              value={followupForm.companyId}
              onChange={(e) => setFollowupForm({ ...followupForm, companyId: e.target.value })}
              required
            >
              <option value="">-- Select Client --</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row flex gap-4">
            <Input
              id="followup-date"
              type="date"
              label="Date"
              value={followupForm.date}
              onChange={(e) => setFollowupForm({ ...followupForm, date: e.target.value })}
              required
            />
            <Input
              id="followup-time"
              type="time"
              label="Time"
              value={followupForm.time}
              onChange={(e) => setFollowupForm({ ...followupForm, time: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="input-field__label" htmlFor="followup-type-select">Interaction Type</label>
            <select
              id="followup-type-select"
              className="dashboard-select"
              value={followupForm.type}
              onChange={(e) => setFollowupForm({ ...followupForm, type: e.target.value })}
            >
              <option value="Phone">Phone Call</option>
              <option value="WhatsApp">WhatsApp Message</option>
              <option value="Email">Email Thread</option>
              <option value="Meeting">Direct Meeting</option>
            </select>
          </div>
          <div className="form-group">
            <label className="input-field__label" htmlFor="followup-notes">Notes / Meeting Agenda</label>
            <textarea
              id="followup-notes"
              className="dashboard-textarea"
              placeholder="Discuss quotation final scope adjustments"
              rows="3"
              value={followupForm.notes}
              onChange={(e) => setFollowupForm({ ...followupForm, notes: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}

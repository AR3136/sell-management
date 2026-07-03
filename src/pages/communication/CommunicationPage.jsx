import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import FileUpload from '../../components/common/FileUpload';
import { logCompanyTimelineEvents } from '../../services/timelineService';
import './CommunicationPage.css';

export default function CommunicationPage() {
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    // Fetch companies along with their communications
    const { data, error } = await supabase
      .from('companies')
      .select(`
        *,
        communications (
          *
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching communication data:', error);
    } else {
      const mappedData = data.map(c => {
        // Sort communications by date descending
        const sortedComms = (c.communications || []).sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastComm = sortedComms.length > 0 ? sortedComms[0] : null;
        
        return {
          id: c.id,
          name: c.name,
          contactPerson: c.contact_person,
          email: c.email,
          phone: c.phone,
          status: lastComm ? lastComm.status : 'New Lead',
          assignedEmployee: c.assigned_employee_id, // Might need to fetch profile name instead
          lastCommunication: lastComm ? {
            date: lastComm.date,
            type: lastComm.type,
            summary: lastComm.summary
          } : { date: 'N/A', type: 'N/A', summary: 'No communication yet.' },
          nextFollowUp: lastComm && lastComm.follow_up_date ? lastComm.follow_up_date : 'N/A',
          history: sortedComms.map(comm => ({
            date: comm.date,
            time: comm.time,
            type: comm.type,
            summary: comm.summary,
            employee: comm.employee_id,
            status: comm.status,
            followUpDate: comm.follow_up_date,
            attachments: comm.attachments || [],
          })),
        };
      });
      setCompanies(mappedData);
    }
    setIsLoading(false);
  };

  // -- Search & Filter State --
  const [searchVal, setSearchVal] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // -- Modal States --
  const [addCommOpen, setAddCommOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeCompany, setActiveCompany] = useState(null);

  // -- Form State --
  const [newComm, setNewComm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: 'Phone',
    summary: '',
    attachments: '',
    employeeName: '',
    followUpDate: '',
    status: 'In Discussion',
  });

  // -- Filter companies --
  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchSearch =
        (c.name || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (c.contactPerson || '').toLowerCase().includes(searchVal.toLowerCase());
      const matchStatus = statusFilter ? c.status === statusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [companies, searchVal, statusFilter]);

  // -- Form Handlers --
  const handleOpenAddComm = (company) => {
    setActiveCompany(company);
    setNewComm({
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'Phone',
      summary: '',
      attachments: [], // array of uploaded URLs
      employeeName: company.assignedEmployee,
      followUpDate: '',
      status: company.status,
    });
    setAddCommOpen(true);
  };

  const handleOpenHistory = (company) => {
    setActiveCompany(company);
    setHistoryOpen(true);
  };

  const handleAddCommSubmit = async (e) => {
    e.preventDefault();
    if (!activeCompany) return;

    const dbPayload = {
      company_id: activeCompany.id,
      date: newComm.date,
      time: newComm.time,
      type: newComm.type,
      summary: newComm.summary,
      // employee_id: newComm.employeeName, // in real app, lookup uuid by name or use session user
      status: newComm.status,
      follow_up_date: newComm.followUpDate || null,
      attachments: newComm.attachments,
    };

    const { error } = await supabase
      .from('communications')
      .insert([dbPayload]);

    if (error) {
      console.error('Error inserting communication:', error);
      alert('Failed to save communication.');
    } else {
      fetchData(); // Refresh the list from Supabase
      setAddCommOpen(false);

      // Log timeline event — pass attachments array directly (not double-wrapped)
      logCompanyTimelineEvents(activeCompany.id, {
        action: 'Communication Added',
        remarks: `Communication logged: type: ${dbPayload.type}, summary: "${dbPayload.summary}". Status set to ${dbPayload.status}.`,
        relatedFiles: Array.isArray(dbPayload.attachments) ? dbPayload.attachments : (dbPayload.attachments ? [dbPayload.attachments] : [])
      });
    }
  };

  // Mock triggers for contact buttons
  const triggerCall = (company) => {
    alert(`Initiating corporate dialer to ${company.contactPerson} at ${company.phone}`);
  };

  const triggerWhatsApp = (company) => {
    alert(`Opening mock secure chat window with ${company.contactPerson} at ${company.phone}`);
  };

  const triggerEmail = (company) => {
    window.location.href = `mailto:${company.email}?subject=Follow%20up%20-%20Company%20Operations%20Portal`;
  };

  return (
    <div className="module-page">
      <div className="module-page__header">
        <h1 className="module-page__title">Communication Module</h1>
        <p className="module-page__subtitle">Track interactions, update client stages, and schedule follow-ups.</p>
      </div>

      {/* Filter and Search controls */}
      <Card padding="md" className="communication-filters-bar flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4 justify-between">
          <div className="topnav__search">
            <span className="material-icons topnav__search-icon">search</span>
            <input
              type="text"
              className="topnav__search-input"
              placeholder="Search companies or contact..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <select
              className="dashboard-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Communication Status"
            >
              <option value="">All Statuses</option>
              <option value="New Lead">New Lead</option>
              <option value="In Discussion">In Discussion</option>
              <option value="Proposed">Proposed</option>
              <option value="Closed Won">Closed Won</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Cards Grid */}
      <div className="communication-grid">
        {filteredCompanies.length === 0 ? (
          <div className="no-records-banner">
            <span className="material-icons">chat_bubble_outline</span>
            <p>No communication records found.</p>
          </div>
        ) : (
          filteredCompanies.map((c) => (
            <Card padding="md" className="communication-card" key={c.id}>
              <div className="communication-card__header flex justify-between items-start">
                <div>
                  <h3 className="communication-card__title">{c.name}</h3>
                  <p className="text-sm text-muted">{c.contactPerson}</p>
                </div>
                <Badge variant={c.status === 'Closed Won' ? 'success' : c.status === 'Proposed' ? 'info' : 'warning'}>
                  {c.status}
                </Badge>
              </div>

              <div className="dropdown-divider" />

              <div className="communication-card__body">
                <p><strong>Assigned Agent:</strong> {c.assignedEmployee}</p>
                <p>
                  <strong>Last Communication:</strong>{' '}
                  <span className="text-sm text-muted">
                    {c.lastCommunication.date} ({c.lastCommunication.type}) &bull; {c.lastCommunication.summary}
                  </span>
                </p>
                <p>
                  <strong>Next Follow-up:</strong>{' '}
                  <Badge variant={c.nextFollowUp === 'N/A' ? 'info' : 'primary'}>{c.nextFollowUp}</Badge>
                </p>
              </div>

              <div className="dropdown-divider" />

              {/* Direct Buttons */}
              <div className="communication-card__actions flex flex-col gap-2">
                <div className="flex gap-2 justify-between">
                  <Button variant="ghost" size="sm" icon="phone" onClick={() => triggerCall(c)}>Call</Button>
                  <Button variant="ghost" size="sm" icon="chat" onClick={() => triggerWhatsApp(c)}>WhatsApp</Button>
                  <Button variant="ghost" size="sm" icon="email" onClick={() => triggerEmail(c)}>Email</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" icon="add" onClick={() => handleOpenAddComm(c)} className="flex-1">
                    Log Inter.
                  </Button>
                  <Button variant="secondary" size="sm" icon="history" onClick={() => handleOpenHistory(c)} className="flex-1">
                    History
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* --- ADD COMMUNICATION MODAL --- */}
      <Modal
        isOpen={addCommOpen}
        onClose={() => setAddCommOpen(false)}
        title={`Add Communication for ${activeCompany?.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddCommOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="add-comm-form">Save Communication</Button>
          </>
        }
      >
        <form id="add-comm-form" onSubmit={handleAddCommSubmit} className="dashboard-modal-form">
          <div className="form-grid-2">
            <Input
              id="comm-date"
              type="date"
              label="Date *"
              value={newComm.date}
              onChange={(e) => setNewComm({ ...newComm, date: e.target.value })}
              required
            />
            <Input
              id="comm-time"
              label="Time *"
              value={newComm.time}
              onChange={(e) => setNewComm({ ...newComm, time: e.target.value })}
              required
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="input-field__label" htmlFor="comm-type-select">Communication Type *</label>
              <select
                id="comm-type-select"
                className="dashboard-select"
                value={newComm.type}
                onChange={(e) => setNewComm({ ...newComm, type: e.target.value })}
                required
              >
                <option value="Phone">Phone</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Email">Email</option>
                <option value="Meeting">Meeting</option>
              </select>
            </div>

            <div className="form-group">
              <label className="input-field__label" htmlFor="comm-status-select">Update Company Status *</label>
              <select
                id="comm-status-select"
                className="dashboard-select"
                value={newComm.status}
                onChange={(e) => setNewComm({ ...newComm, status: e.target.value })}
                required
              >
                <option value="New Lead">New Lead</option>
                <option value="In Discussion">In Discussion</option>
                <option value="Proposed">Proposed</option>
                <option value="Closed Won">Closed Won</option>
              </select>
            </div>
          </div>

          <Input
            id="comm-emp"
            label="Log Writer (Employee Name) *"
            value={newComm.employeeName}
            onChange={(e) => setNewComm({ ...newComm, employeeName: e.target.value })}
            required
          />

          <div className="form-group">
            <label className="input-field__label" htmlFor="comm-summary">Discussion Summary *</label>
            <textarea
              id="comm-summary"
              className="dashboard-textarea"
              rows="3"
              value={newComm.summary}
              onChange={(e) => setNewComm({ ...newComm, summary: e.target.value })}
              required
            />
          </div>

          <div className="form-grid-2">
            <Input
              id="comm-followup"
              type="date"
              label="Next Follow-up Date"
              value={newComm.followUpDate}
              onChange={(e) => setNewComm({ ...newComm, followUpDate: e.target.value })}
            />
            <div className="form-group">
              <FileUpload
                label="Add Attachment"
                onUploadSuccess={(url) => {
                  // Use functional update to avoid stale closure on rapid uploads
                  setNewComm(prev => ({
                    ...prev,
                    attachments: [...(Array.isArray(prev.attachments) ? prev.attachments : []), url]
                  }));
                }}
              />
              <div className="uploaded-files-list flex flex-col gap-1 text-xs text-muted" style={{ marginTop: 'var(--space-1)' }}>
                {newComm.attachments && newComm.attachments.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="material-icons text-success" style={{ fontSize: '14px' }}>check_circle</span>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="underline truncate" style={{ maxWidth: '180px' }}>
                      Attachment #{idx + 1}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* --- HISTORY TIMELINE MODAL --- */}
      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Communication History: ${activeCompany?.name}`}
        size="lg"
      >
        <div className="history-timeline">
          {activeCompany?.history?.map((h, i) => (
            <div className="history-timeline-item" key={i}>
              <div className="history-timeline-item__meta flex justify-between">
                <span className="font-semibold text-primary">{h.type} &bull; {h.date} at {h.time}</span>
                <Badge variant={h.status === 'Closed Won' ? 'success' : 'warning'}>{h.status}</Badge>
              </div>
              <p className="history-timeline-item__summary">{h.summary}</p>
              <div className="history-timeline-item__footer flex justify-between items-center text-xs text-muted">
                <span>Recorded by: {h.employee}</span>
                {h.followUpDate && <span>Next Follow-up: {h.followUpDate}</span>}
              </div>
              {h.attachments && h.attachments.length > 0 && (
                <div className="history-timeline-item__attachments flex gap-2 flex-wrap">
                  {h.attachments.map((file, j) => {
                    const isUrl = file.startsWith('http');
                    return (
                      <div key={j} className="attachment-badge">
                        <span className="material-icons">attach_file</span>
                        {isUrl ? (
                          <a href={file} target="_blank" rel="noopener noreferrer" className="underline truncate" style={{ maxWidth: '150px' }}>
                            File #{j + 1}
                          </a>
                        ) : (
                          <span>{file}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

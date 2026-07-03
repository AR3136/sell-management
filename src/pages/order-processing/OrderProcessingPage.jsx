import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { syncOrderToSheets } from '../../services/sheetsSyncService';
import { logTimelineEvent } from '../../services/timelineService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import FileUpload from '../../components/common/FileUpload';
import './OrderProcessingPage.css';

export default function OrderProcessingPage() {
  // -- Definitive Steps list --
  const workflowSteps = [
    'Requirement Received',
    'Sent to Manufacturer',
    'Technical Validation',
    'Quotation Received',
    'Quotation Shared',
    'Customer Decision',
    'Buying Timeline',
    'Manufacturer Availability',
    'Payment Cycle Finalized',
    'Order Processing',
    'Completed',
  ];

  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        companies (name),
        order_steps (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
    } else {
      const mappedOrders = data.map(o => {
        // Construct stepsData dictionary
        const stepsData = {};
        for (let i = 0; i < workflowSteps.length; i++) {
          const stepRecord = o.order_steps.find(s => s.step_index === i);
          if (stepRecord) {
            stepsData[i] = {
              id: stepRecord.id,
              date: stepRecord.date || '',
              employee: stepRecord.employee_id || '', // Map to name ideally
              remarks: stepRecord.remarks || '',
              attachments: stepRecord.attachments || '',
            };
          } else {
            stepsData[i] = { id: null, date: '', employee: '', remarks: '', attachments: '' };
          }
        }

        return {
          id: o.id,
          companyId: o.company_id,
          company: o.companies?.name || 'Unknown',
          project: o.project,
          currentStepIndex: o.current_step_index,
          customerDecision: o.customer_decision,
          spreadsheetId: o.spreadsheet_id,
          spreadsheetUrl: o.spreadsheet_url,
          syncStatus: o.sync_status,
          lastSyncTime: o.last_sync_time,
          syncResult: o.sync_result,
          stepsData,
        };
      });
      setOrders(mappedOrders);
      // Auto-select the first order if none is selected yet
      setSelectedOrderId(prev => prev || (mappedOrders[0]?.id ?? null));
    }
    setIsLoading(false);
  };

  // -- Selection State -- start with null; resolved by useMemo once orders load
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editStepIndex, setEditStepIndex] = useState(0);

  // -- Timeline States --
  const [timeline, setTimeline] = useState([]);
  const [timelineFilter, setTimelineFilter] = useState('');
  const [timelineSearch, setTimelineSearch] = useState('');

  const fetchTimeline = async () => {
    const activeId = selectedOrderId || (orders[0] ? orders[0].id : null);
    if (!activeId) return;
    const { data, error } = await supabase
      .from('order_timeline')
      .select('*')
      .eq('order_id', activeId)
      .order('created_at', { ascending: true }); // Chronological order
    if (data) {
      setTimeline(data);
    }
  };

  // Intentionally exclude `orders` from deps – fetchTimeline only needs the active ID.
  // Including orders would cause an infinite loop since fetchOrders updates orders state.
  useEffect(() => {
    fetchTimeline();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  // -- Form State for Step Editing --
  const [editForm, setEditForm] = useState({
    date: '',
    employee: '',
    remarks: '',
    attachments: '',
  });

  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.id === selectedOrderId) || orders[0];
  }, [orders, selectedOrderId]);

  const filteredTimeline = useMemo(() => {
    return timeline.filter(entry => {
      const matchFilter = timelineFilter ? entry.action === timelineFilter : true;
      const matchSearch = timelineSearch
        ? (
            (entry.action || '').toLowerCase().includes(timelineSearch.toLowerCase()) ||
            (entry.remarks || '').toLowerCase().includes(timelineSearch.toLowerCase()) ||
            (entry.employee_name || '').toLowerCase().includes(timelineSearch.toLowerCase())
          )
        : true;
      return matchFilter && matchSearch;
    });
  }, [timeline, timelineFilter, timelineSearch]);

  const handleForceSync = async () => {
    if (!selectedOrder) return;
    setIsSyncing(true);
    const res = await syncOrderToSheets(selectedOrder.id);
    setIsSyncing(false);
    if (res.success) {
      alert('Synchronization successful! Google Sheet updated.');
      fetchOrders();
    } else {
      alert('Synchronization failed: ' + res.error);
      fetchOrders();
    }
  };

  // Move step active index back/forth
  const handleMoveStep = async (newIndex) => {
    if (newIndex < 0 || newIndex >= workflowSteps.length) return;
    
    // Update step index on current order
    const { error } = await supabase
      .from('orders')
      .update({ current_step_index: newIndex })
      .eq('id', selectedOrder.id);
      
    if (error) {
      console.error('Error updating order step index:', error);
      alert('Failed to update step index.');
    } else {
      fetchOrders();
      logTimelineEvent({
        orderId: selectedOrder.id,
        action: 'Status Changed',
        remarks: `Workflow production phase moved to: "${workflowSteps[newIndex]}".`
      });
      syncOrderToSheets(selectedOrder.id); // Trigger background sync
    }
  };

  // Open Edit Modal for a specific step index
  const openEditStep = (index) => {
    setEditStepIndex(index);
    const data = selectedOrder.stepsData[index] || { id: null, date: '', employee: '', remarks: '', attachments: '' };
    setEditForm({
      id: data.id,
      date: data.date,
      employee: data.employee,
      remarks: data.remarks,
      attachments: data.attachments,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    const dbPayload = {
      order_id: selectedOrder.id,
      step_index: editStepIndex,
      date: editForm.date || null,
      employee_id: editForm.employee, // In real app use UUID
      remarks: editForm.remarks,
      attachments: editForm.attachments,
    };
    
    if (editForm.id) {
      // Update existing step
      const { error } = await supabase
        .from('order_steps')
        .update(dbPayload)
        .eq('id', editForm.id);
        
      if (error) {
        console.error('Error updating order step:', error);
        alert('Failed to save step.');
        return;
      }
    } else {
      // Insert new step
      const { error } = await supabase
        .from('order_steps')
        .insert([dbPayload]);
        
      if (error) {
        console.error('Error inserting order step:', error);
        alert('Failed to save step.');
        return;
      }
    }
    
    // Resolve Timeline Action
    let actionType = 'Status Changed';
    let remarksText = `Workflow stage "${workflowSteps[editStepIndex]}" updated. Remarks: "${editForm.remarks || 'No remarks added.'}"`;
    
    if (editStepIndex === 0) {
      actionType = editForm.attachments ? 'Drawing Uploaded' : 'Status Changed';
    } else if (editStepIndex === 1) {
      actionType = editForm.attachments ? 'Quotation Uploaded' : 'Status Changed';
      if (editForm.attachments) remarksText = `Quotation document uploaded for this order. Remarks: "${editForm.remarks || ''}"`;
    } else if (editStepIndex === 2) {
      actionType = 'Quotation Shared';
    } else if (editStepIndex === 3) {
      actionType = 'Machine Availability Updated';
    } else if (editStepIndex === 4) {
      actionType = 'Buying Timeline Updated';
    } else if (editStepIndex === 5) {
      actionType = 'Customer Decision Updated';
    } else if (editForm.attachments) {
      actionType = 'Files Added';
    }

    logTimelineEvent({
      orderId: selectedOrder.id,
      action: actionType,
      remarks: remarksText,
      relatedFiles: editForm.attachments ? [editForm.attachments] : []
    });

    fetchOrders();
    setEditModalOpen(false);
    syncOrderToSheets(selectedOrder.id);
  };

  const handleCustomerDecisionChange = async (val) => {
    let newStepIndex = val === 'Proceed' && selectedOrder.currentStepIndex === 5 ? 6 : selectedOrder.currentStepIndex;
    
    const { error } = await supabase
      .from('orders')
      .update({ 
        customer_decision: val,
        current_step_index: newStepIndex 
      })
      .eq('id', selectedOrder.id);
      
    if (error) {
      console.error('Error updating customer decision:', error);
      alert('Failed to update customer decision.');
    } else {
      fetchOrders();
      logTimelineEvent({
        orderId: selectedOrder.id,
        action: 'Customer Decision Updated',
        remarks: `Customer decision updated to: "${val}".`
      });
      if (newStepIndex !== selectedOrder.currentStepIndex) {
        logTimelineEvent({
          orderId: selectedOrder.id,
          action: 'Status Changed',
          remarks: `Order approved! Workflow production phase moved to: "${workflowSteps[newStepIndex]}".`
        });
      }
      syncOrderToSheets(selectedOrder.id);
    }
  };

  return (
    <div className="module-page">
      {/* Header */}
      <div className="module-page__header flex justify-between items-center">
        <div>
          <h1 className="module-page__title">Order Processing Workflow</h1>
          <p className="module-page__subtitle">Track manufacturer production phases, quotations, and validation timelines.</p>
        </div>
        <div className="flex gap-3">
          {orders.map((o) => (
            <Button
              key={o.id}
              variant={selectedOrderId === o.id ? 'primary' : 'outline'}
              onClick={() => setSelectedOrderId(o.id)}
            >
              {o.company} ({o.id})
            </Button>
          ))}
        </div>
      </div>

      {selectedOrder && (
        <div className="order-workflow-layout flex flex-col gap-6">
          {/* Google Sheets Integration Card */}
          <Card padding="md" className="sheets-sync-card border-box-reference">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h4 className="font-bold color-primary flex items-center gap-2" style={{ margin: 0 }}>
                  <span className="material-icons text-info">description</span>
                  Google Spreadsheet Live Backup Record
                </h4>
                <div className="flex gap-4 text-xs text-muted flex-wrap" style={{ marginTop: 'var(--space-1)' }}>
                  <span>Status: <strong className={`text-${selectedOrder.syncStatus === 'Success' ? 'success' : selectedOrder.syncStatus === 'Failed' ? 'danger' : 'warning'}`}>{selectedOrder.syncStatus || 'Pending'}</strong></span>
                  <span>Last Sync: {selectedOrder.lastSyncTime ? new Date(selectedOrder.lastSyncTime).toLocaleString() : 'Never'}</span>
                  {selectedOrder.syncResult && <span>Result: <em>{selectedOrder.syncResult}</em></span>}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedOrder.spreadsheetUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(selectedOrder.spreadsheetUrl, '_blank')} icon="open_in_new">
                    Open Google Sheet
                  </Button>
                )}
                <Button variant="primary" size="sm" onClick={handleForceSync} icon="sync" disabled={isSyncing}>
                  {isSyncing ? 'Syncing...' : 'Force Sync'}
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchOrders} icon="refresh">
                  Refresh Sync Status
                </Button>
              </div>
            </div>
          </Card>

          {/* Visual Progress Bar */}
          <Card padding="md" className="workflow-progress-card">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold color-primary">{selectedOrder.project}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={selectedOrder.currentStepIndex === 0}
                  onClick={() => handleMoveStep(selectedOrder.currentStepIndex - 1)}
                  icon="arrow_back"
                >
                  Prev Stage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={selectedOrder.currentStepIndex === workflowSteps.length - 1}
                  onClick={() => handleMoveStep(selectedOrder.currentStepIndex + 1)}
                  iconRight="arrow_forward"
                >
                  Next Stage
                </Button>
              </div>
            </div>

            {/* Step Indicators Tracker */}
            <div className="workflow-steps-tracker">
              {workflowSteps.map((step, index) => {
                const isActive = index === selectedOrder.currentStepIndex;
                const isCompleted = index < selectedOrder.currentStepIndex;
                return (
                  <div
                    key={index}
                    className={`tracker-step ${isActive ? 'tracker-step--active' : ''} ${
                      isCompleted ? 'tracker-step--completed' : ''
                    }`}
                    onClick={() => handleMoveStep(index)}
                    title={`Click to set stage to: ${step}`}
                  >
                    <div className="tracker-step__dot">
                      {isCompleted ? (
                        <span className="material-icons">check</span>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <span className="tracker-step__label">{step}</span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Customer Decision Handler Widget (shows if current index is Customer Decision) */}
          {selectedOrder.currentStepIndex === 5 && (
            <Card padding="md" className="decision-bar border-box-reference">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h4 className="font-bold color-primary">Customer Decision Stage Action Required</h4>
                  <p className="text-sm text-muted">Select customer response to advance workflow.</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant={selectedOrder.customerDecision === 'Proceed' ? 'primary' : 'outline'}
                    onClick={() => handleCustomerDecisionChange('Proceed')}
                  >
                    Proceed (Advance)
                  </Button>
                  <Button
                    variant={selectedOrder.customerDecision === 'Self Procurement' ? 'danger' : 'outline'}
                    onClick={() => handleCustomerDecisionChange('Self Procurement')}
                  >
                    Self Procurement
                  </Button>
                  <Button
                    variant={selectedOrder.customerDecision === 'Pending' ? 'warning' : 'outline'}
                    onClick={() => handleCustomerDecisionChange('Pending')}
                  >
                    Pending Decision
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Steps Detail Cards Grid */}
          <div className="workflow-cards-grid">
            {workflowSteps.map((step, index) => {
              const data = selectedOrder.stepsData[index] || { date: '', employee: '', remarks: '', attachments: '' };
              const isActive = index === selectedOrder.currentStepIndex;
              const isCompleted = index < selectedOrder.currentStepIndex;
              const isFuture = index > selectedOrder.currentStepIndex;

              let statusText = 'Pending';
              let statusVar = 'info';
              if (isActive) {
                statusText = 'Active Stage';
                statusVar = 'warning';
              } else if (isCompleted) {
                statusText = 'Completed';
                statusVar = 'success';
              }

              return (
                <Card
                  padding="md"
                  className={`step-card ${isActive ? 'step-card--active' : ''} ${
                    isFuture ? 'step-card--future' : ''
                  }`}
                  key={index}
                >
                  <div className="step-card__header flex justify-between items-center">
                    <span className="step-card__title font-bold">
                      {index + 1}. {step}
                    </span>
                    <Badge variant={statusVar}>{statusText}</Badge>
                  </div>

                  <div className="dropdown-divider" />

                  <div className="step-card__body">
                    <p><strong>Date:</strong> {data.date || 'N/A'}</p>
                    <p><strong>Responsible Employee:</strong> {data.employee || 'N/A'}</p>
                    <p><strong>Remarks:</strong> {data.remarks || 'No remarks recorded.'}</p>
                    {data.attachments && (
                      <div className="attachment-badge" style={{ marginTop: 'var(--space-2)' }}>
                        <span className="material-icons">attach_file</span>
                        {data.attachments.startsWith('http') ? (
                          <a href={data.attachments} target="_blank" rel="noopener noreferrer" className="underline truncate" style={{ maxWidth: '200px' }}>
                            View Attachment
                          </a>
                        ) : (
                          <span>{data.attachments}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="dropdown-divider" />

                  <div className="step-card__actions flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="edit"
                      onClick={() => openEditStep(index)}
                      className="w-full"
                    >
                      Edit Stage Details
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Order Timeline Section */}
          <Card padding="lg" className="order-timeline-card border-box-reference">
            <div className="flex justify-between items-center flex-wrap gap-4" style={{ marginBottom: 'var(--space-4)' }}>
              <div>
                <h3 className="font-bold text-lg color-primary" style={{ margin: 0 }}>Order Activity Timeline</h3>
                <p className="text-sm text-muted">Complete historical transaction logs for this order in chronological order.</p>
              </div>

              {/* Timeline Controls */}
              <div className="flex gap-2 flex-wrap items-center">
                <select
                  className="dashboard-select text-xs"
                  value={timelineFilter}
                  onChange={(e) => setTimelineFilter(e.target.value)}
                  style={{ width: '180px', height: '36px' }}
                >
                  <option value="">All Actions</option>
                  <option value="Requirement Created">Requirement Created</option>
                  <option value="Requirement Updated">Requirement Updated</option>
                  <option value="Communication Added">Communication Added</option>
                  <option value="Quotation Uploaded">Quotation Uploaded</option>
                  <option value="Quotation Shared">Quotation Shared</option>
                  <option value="Customer Decision Updated">Customer Decision Updated</option>
                  <option value="Machine Availability Updated">Machine Availability Updated</option>
                  <option value="Buying Timeline Updated">Buying Timeline Updated</option>
                  <option value="Payment Updated">Payment Updated</option>
                  <option value="Status Changed">Status Changed</option>
                  <option value="Drawing Uploaded">Drawing Uploaded</option>
                  <option value="Files Added">Files Added</option>
                </select>

                <div className="topnav__search" style={{ margin: 0, height: '36px' }}>
                  <span className="material-icons topnav__search-icon" style={{ fontSize: '18px' }}>search</span>
                  <input
                    type="text"
                    className="topnav__search-input text-xs"
                    placeholder="Search timeline..."
                    value={timelineSearch}
                    onChange={(e) => setTimelineSearch(e.target.value)}
                    style={{ paddingLeft: '32px' }}
                  />
                </div>
              </div>
            </div>

            <div className="dropdown-divider" />

            <div className="timeline-thread flex flex-col gap-4" style={{ marginTop: 'var(--space-4)' }}>
              {filteredTimeline.length === 0 ? (
                <div className="text-center text-muted text-sm py-8 font-semibold">
                  No timeline entries matched the current search/filters.
                </div>
              ) : (
                filteredTimeline.map((entry) => {
                  const dateObj = new Date(entry.created_at);
                  const formattedDate = dateObj.toLocaleDateString();
                  const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  
                  return (
                    <div key={entry.id} className="timeline-entry flex gap-4" style={{ position: 'relative' }}>
                      {/* Visual Line connector */}
                      <div className="timeline-icon-col flex flex-col items-center">
                        <div className="timeline-circle flex items-center justify-center bg-primary-light" style={{ width: '32px', height: '32px', borderRadius: '50%', color: 'var(--color-surface)' }}>
                          <span className="material-icons" style={{ fontSize: '16px' }}>
                            {entry.action === 'Requirement Created' ? 'assignment' :
                             entry.action === 'Requirement Updated' ? 'edit' :
                             entry.action === 'Communication Added' ? 'chat' :
                             entry.action === 'Quotation Uploaded' ? 'cloud_upload' :
                             entry.action === 'Quotation Shared' ? 'share' :
                             entry.action === 'Payment Updated' ? 'payments' :
                             entry.action === 'Drawing Uploaded' ? 'architecture' :
                             entry.action === 'Files Added' ? 'attach_file' : 'sync'}
                          </span>
                        </div>
                      </div>

                      <div className="timeline-content-col flex-1" style={{ backgroundColor: 'var(--color-surface-hover)', padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--border-radius-sm)' }}>
                        <div className="flex justify-between items-center flex-wrap gap-2">
                          <span className="text-sm font-bold text-success">{entry.action}</span>
                          <span className="text-xs text-muted font-medium">{formattedDate} at {formattedTime}</span>
                        </div>
                        
                        <p className="text-sm text-light font-medium" style={{ margin: '4px 0 0 0' }}>{entry.remarks}</p>
                        
                        <div className="flex justify-between items-center flex-wrap gap-2 text-xs text-muted" style={{ marginTop: 'var(--space-2)' }}>
                          <span>Logged by: <strong>{entry.employee_name}</strong></span>
                        </div>

                        {entry.related_files && entry.related_files.length > 0 && (
                          <div className="timeline-files flex gap-2 flex-wrap" style={{ marginTop: 'var(--space-2)' }}>
                            {entry.related_files.map((file, idx) => (
                              <a
                                key={idx}
                                href={file}
                                target="_blank"
                                rel="noreferrer"
                                className="attachment-badge flex items-center gap-1 text-xs text-success underline font-semibold truncate"
                                style={{ maxWidth: '200px' }}
                              >
                                <span className="material-icons" style={{ fontSize: '14px' }}>attach_file</span>
                                File #{idx + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      {/* --- EDIT STAGE DETAILS MODAL --- */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Stage: ${workflowSteps[editStepIndex]}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="edit-step-form">Save Stage Info</Button>
          </>
        }
      >
        <form id="edit-step-form" onSubmit={handleEditSubmit} className="dashboard-modal-form">
          <Input
            id="step-date"
            type="date"
            label="Stage Date"
            value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
            required
          />
          <Input
            id="step-emp"
            label="Responsible Employee"
            value={editForm.employee}
            onChange={(e) => setEditForm({ ...editForm, employee: e.target.value })}
            required
          />
          <div className="form-group">
            <label className="input-field__label" htmlFor="step-remarks">Remarks</label>
            <textarea
              id="step-remarks"
              className="dashboard-textarea"
              rows="3"
              value={editForm.remarks}
              onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
            />
          </div>
          <div className="form-group">
            <FileUpload
              label="Stage Attachment File"
              onUploadSuccess={(url) => setEditForm({ ...editForm, attachments: url })}
            />
            {editForm.attachments && (
              <a href={editForm.attachments} target="_blank" rel="noopener noreferrer" className="text-xs underline text-success truncate block">
                {editForm.attachments.startsWith('http') ? 'View Uploaded Attachment' : editForm.attachments}
              </a>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
}

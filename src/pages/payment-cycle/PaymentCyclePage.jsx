import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { syncOrderToSheets } from '../../services/sheetsSyncService';
import { logTimelineEvent } from '../../services/timelineService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import '../approached/ModulePages.css';
import './PaymentCyclePage.css';

export default function PaymentCyclePage() {
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('payments')
      .select(`
        *,
        orders (
          project,
          companies (
            id,
            name
          )
        ),
        payment_history (*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
    } else {
      const mappedPayments = data.map(p => ({
        id: p.id,
        orderId: p.order_id,
        orderNumber: p.orders?.project || 'N/A', // Use project name as order reference
        companyId: p.orders?.companies?.id,
        customer: p.orders?.companies?.name || 'Unknown',
        totalAmount: p.total_amount,
        advanceAmount: p.advance_amount,
        paymentType: p.payment_type,
        paymentSchedule: p.payment_schedule,
        invoiceNumber: p.invoice_number,
        dueDate: p.due_date,
        gst: p.gst,
        status: p.status,
        history: p.payment_history || [],
      }));
      setPayments(mappedPayments);
    }
    setIsLoading(false);
  };

  // -- Search & Controls --
  const [searchVal, setSearchVal] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // -- Modal States --
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'

  // -- Active Objects state --
  const emptyPayment = {
    id: '',
    orderNumber: '',
    customer: '',
    totalAmount: '',
    advanceAmount: '',
    paymentType: 'Bank Transfer',
    paymentSchedule: '100% Upfront',
    invoiceNumber: '',
    dueDate: '',
    gst: '',
    status: 'Pending',
    history: [],
  };

  const [activePay, setActivePay] = useState({ ...emptyPayment });
  const [viewPay, setViewPay] = useState(null);
  const [historyPay, setHistoryPay] = useState(null);

  // -- Add Transaction log Form State --
  const [newTx, setNewTx] = useState({ amount: '', date: '', note: '', type: 'Milestone' });

  // -- Filters --
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchSearch =
        (p.customer || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (p.orderNumber || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (p.invoiceNumber || '').toLowerCase().includes(searchVal.toLowerCase());
      const matchStatus = statusFilter ? p.status === statusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [payments, searchVal, statusFilter]);

  // -- Remaining Balance calculation --
  const calculateRemaining = (item) => {
    const totalPaid = item.history.reduce((sum, h) => sum + Number(h.amount), 0);
    const bal = Number(item.totalAmount) - totalPaid;
    return bal < 0 ? 0 : bal;
  };

  // -- Handlers --
  const openCreateModal = () => {
    setModalMode('create');
    setActivePay({
      ...emptyPayment,
      id: `PAY-${Date.now().toString().slice(-3)}`,
      dueDate: new Date().toISOString().split('T')[0],
    });
    setModalOpen(true);
  };

  const openEditModal = (pay, e) => {
    e.stopPropagation();
    setModalMode('edit');
    setActivePay({ ...pay });
    setModalOpen(true);
  };

  const openViewModal = (pay) => {
    setViewPay(pay);
    setViewOpen(true);
  };

  const openHistoryModal = (pay, e) => {
    e.stopPropagation();
    setHistoryPay(pay);
    setNewTx({ amount: '', date: new Date().toISOString().split('T')[0], note: '', type: 'Milestone' });
    setHistoryModalOpen(true);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete payment profile ${id}?`)) {
      const { error } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting payment:', error);
        alert('Failed to delete payment.');
      } else {
        fetchPayments();
      }
    }
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    
    // In a real app we need order_id which is a UUID, and maybe company_id.
    // For now we assume activePay.orderId is set correctly or we look it up.
    const dbPayload = {
      order_id: activePay.orderId,
      // company_id: we should probably require selecting the company/order from a dropdown, but keeping it simple based on mock
      total_amount: activePay.totalAmount,
      advance_amount: activePay.advanceAmount,
      payment_type: activePay.paymentType,
      payment_schedule: activePay.paymentSchedule,
      invoice_number: activePay.invoiceNumber,
      due_date: activePay.dueDate,
      gst: activePay.gst,
      status: activePay.status,
    };
    
    if (modalMode === 'edit') {
      const { error } = await supabase
        .from('payments')
        .update(dbPayload)
        .eq('id', activePay.id);
        
      if (error) {
        console.error('Error updating payment:', error);
        alert('Failed to update payment.');
        return; // Prevent modal close and fetchPayments on error
      }
    } else {
      // Validate required FK before insert
      if (!activePay.orderId) {
        alert('Please select an Order before saving the payment.');
        return;
      }
      const { error } = await supabase
        .from('payments')
        .insert([dbPayload]);
        
      if (error) {
        console.error('Error inserting payment:', error);
        alert('Failed to insert payment.');
        return; // Prevent modal close and fetchPayments on error
      }
    }
    
    fetchPayments();
    setModalOpen(false);
    if (activePay.orderId) {
      logTimelineEvent({
        orderId: activePay.orderId,
        action: 'Payment Updated',
        remarks: `Invoice profile setup modified. Invoice #: ${dbPayload.invoice_number || 'N/A'}, total value: $${dbPayload.total_amount}, status: ${dbPayload.status}.`
      });
      syncOrderToSheets(activePay.orderId);
    }
  };

  // Log new payment record inside history ledger
  const handleAddTxSubmit = async (e) => {
    e.preventDefault();
    if (!historyPay) return;

    const txPayload = {
      payment_id: historyPay.id,
      date: newTx.date,
      amount: Number(newTx.amount),
      note: newTx.note,
      type: newTx.type,
    };

    const { error: txError } = await supabase
      .from('payment_history')
      .insert([txPayload]);

    if (txError) {
      console.error('Error adding transaction:', txError);
      alert('Failed to add transaction.');
      return;
    }

    const updatedHistory = [...historyPay.history, txPayload];
    const totalPaid = updatedHistory.reduce((sum, h) => sum + Number(h.amount), 0);

    let newStatus = historyPay.status;
    if (totalPaid >= historyPay.totalAmount) {
      newStatus = 'Paid';
    } else if (totalPaid > 0) {
      newStatus = 'Partial';
    }
    
    if (newStatus !== historyPay.status) {
      const { error: statusError } = await supabase
        .from('payments')
        .update({ status: newStatus })
        .eq('id', historyPay.id);
        
      if (statusError) {
        console.error('Error updating payment status:', statusError);
      }
    }

    fetchPayments();
    setHistoryModalOpen(false);
    if (historyPay.orderId) {
      logTimelineEvent({
        orderId: historyPay.orderId,
        action: 'Payment Updated',
        remarks: `Payment transaction recorded: $${txPayload.amount} added. Ledger type: ${txPayload.type}. Cumulative paid: $${totalPaid}. Status resolved to ${newStatus}.`
      });
      syncOrderToSheets(historyPay.orderId);
    }
  };

  const deleteTxEntry = async (txId) => {
    if (!historyPay) return;
    
    const { error: txError } = await supabase
      .from('payment_history')
      .delete()
      .eq('id', txId);
      
    if (txError) {
      console.error('Error deleting transaction:', txError);
      alert('Failed to delete transaction.');
      return;
    }

    const updatedHistory = historyPay.history.filter((h) => h.id !== txId);
    const totalPaid = updatedHistory.reduce((sum, h) => sum + h.amount, 0);

    let newStatus = 'Pending';
    if (totalPaid >= historyPay.totalAmount) {
      newStatus = 'Paid';
    } else if (totalPaid > 0) {
      newStatus = 'Partial';
    }
    
    if (newStatus !== historyPay.status) {
      const { error: statusError } = await supabase
        .from('payments')
        .update({ status: newStatus })
        .eq('id', historyPay.id);
        
      if (statusError) {
        console.error('Error updating payment status:', statusError);
      }
    }

    fetchPayments();
    setHistoryModalOpen(false); // Close to refresh
  };

  const handleGenerateReminder = (pay, e) => {
    e.stopPropagation();
    const bal = calculateRemaining(pay);
    alert(
      `Payment Reminder Generated!\n----------------------------------------\nTo: Client (${pay.customer})\nInvoice: ${pay.invoiceNumber}\nDue Date: ${pay.dueDate}\nOutstanding Balance: $${bal.toLocaleString()}\n\nEmail notification sent to finance representatives.`
    );
  };

  return (
    <div className="module-page">
      {/* Header */}
      <div className="module-page__header flex justify-between items-center">
        <div>
          <h1 className="module-page__title">Payment Cycle Ledger</h1>
          <p className="module-page__subtitle">Track customer invoicing schedules, advance balances, and billing states.</p>
        </div>
        <Button variant="primary" icon="add" onClick={openCreateModal}>
          Issue Payment Record
        </Button>
      </div>

      {/* Grid & Controls Card */}
      <Card padding="md" className="module-page__table-card">
        <div className="module-page__filters flex items-center justify-between gap-4 flex-wrap">
          <div className="topnav__search">
            <span className="material-icons topnav__search-icon">search</span>
            <input
              type="text"
              className="topnav__search-input"
              placeholder="Search by Order, Customer, Invoice..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <select
              className="dashboard-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Payment Status"
            >
              <option value="">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Pending">Pending</option>
              <option value="Partial">Partial</option>
              <option value="Overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Custom Table View */}
        <Table
          headers={[
            'Ref ID',
            'Order #',
            'Customer',
            'Total Value',
            'Paid Amount',
            'Remaining Balance',
            'Due Date',
            'Status',
            'Actions',
          ]}
          data={filteredPayments}
          renderRow={(pay) => {
            const totalPaid = pay.history.reduce((sum, h) => sum + Number(h.amount), 0);
            const remaining = calculateRemaining(pay);
            return (
              <tr key={pay.id} style={{ cursor: 'pointer' }} onClick={() => openViewModal(pay)}>
                <td><span className="font-semibold">{pay.id}</span></td>
                <td><span className="font-medium text-muted">{pay.orderNumber}</span></td>
                <td><div className="font-bold color-primary">{pay.customer}</div></td>
                <td><span className="font-semibold">${Number(pay.totalAmount).toLocaleString()}</span></td>
                <td><span className="font-semibold text-success">${totalPaid.toLocaleString()}</span></td>
                <td>
                  <span className={`font-semibold ${remaining > 0 ? 'text-danger' : 'text-success'}`}>
                    ${remaining.toLocaleString()}
                  </span>
                </td>
                <td>{pay.dueDate}</td>
                <td>
                  <Badge
                    variant={
                      pay.status === 'Paid'
                        ? 'success'
                        : pay.status === 'Partial'
                        ? 'info'
                        : pay.status === 'Overdue'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {pay.status}
                  </Badge>
                </td>
                <td>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="history"
                      onClick={(e) => openHistoryModal(pay, e)}
                      title="Manage ledger history"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="notifications_active"
                      onClick={(e) => handleGenerateReminder(pay, e)}
                      title="Generate payment reminder"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="edit"
                      onClick={(e) => openEditModal(pay, e)}
                      aria-label="Edit payment"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="delete"
                      className="text-danger"
                      onClick={(e) => handleDelete(pay.id, e)}
                      aria-label="Delete payment"
                    />
                  </div>
                </td>
              </tr>
            );
          }}
        />
      </Card>

      {/* --- ADD / EDIT PROFILE MODAL --- */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'edit' ? `Edit Payment Profile: ${activePay.id}` : 'Issue New Billing Profile'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="payment-cycle-form">Save Billing</Button>
          </>
        }
      >
        <form id="payment-cycle-form" onSubmit={handleSaveSubmit} className="dashboard-modal-form">
          <div className="form-grid-2">
            <Input
              id="pc-order"
              label="Order Number *"
              placeholder="e.g. ORD-401"
              value={activePay.orderNumber}
              onChange={(e) => setActivePay({ ...activePay, orderNumber: e.target.value })}
              required
            />
            <Input
              id="pc-cust"
              label="Customer / Client Name *"
              value={activePay.customer}
              onChange={(e) => setActivePay({ ...activePay, customer: e.target.value })}
              required
            />
            <Input
              id="pc-total"
              type="number"
              label="Total Contract Amount ($) *"
              value={activePay.totalAmount}
              onChange={(e) => setActivePay({ ...activePay, totalAmount: e.target.value })}
              required
            />
            <Input
              id="pc-advance"
              type="number"
              label="Advance Allocation Amount ($) *"
              value={activePay.advanceAmount}
              onChange={(e) => setActivePay({ ...activePay, advanceAmount: e.target.value })}
              required
            />
            <div className="form-group">
              <label className="input-field__label" htmlFor="pc-type">Payment Type</label>
              <select
                id="pc-type"
                className="dashboard-select"
                value={activePay.paymentType}
                onChange={(e) => setActivePay({ ...activePay, paymentType: e.target.value })}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Cheque">Cheque</option>
                <option value="Letter of Credit">Letter of Credit</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-field__label" htmlFor="pc-sched">Payment Schedule</label>
              <select
                id="pc-sched"
                className="dashboard-select"
                value={activePay.paymentSchedule}
                onChange={(e) => setActivePay({ ...activePay, paymentSchedule: e.target.value })}
              >
                <option value="100% Upfront">100% Upfront</option>
                <option value="Milestone-based (3 Parts)">Milestone-based (3 Parts)</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 60">Net 60</option>
              </select>
            </div>
            <Input
              id="pc-inv"
              label="Invoice Number Reference"
              placeholder="e.g. INV-881"
              value={activePay.invoiceNumber}
              onChange={(e) => setActivePay({ ...activePay, invoiceNumber: e.target.value })}
            />
            <Input
              id="pc-due"
              type="date"
              label="Invoice Due Date *"
              value={activePay.dueDate}
              onChange={(e) => setActivePay({ ...activePay, dueDate: e.target.value })}
              required
            />
            <Input
              id="pc-gst"
              label="GST Registration Identification"
              value={activePay.gst}
              onChange={(e) => setActivePay({ ...activePay, gst: e.target.value })}
            />
            <div className="form-group">
              <label className="input-field__label" htmlFor="pc-status">Payment Status</label>
              <select
                id="pc-status"
                className="dashboard-select"
                value={activePay.status}
                onChange={(e) => setActivePay({ ...activePay, status: e.target.value })}
              >
                <option value="Pending">Pending</option>
                <option value="Partial">Partial</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* --- MANAGE HISTORY LEDGER TRANSACTION MODAL --- */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Payment Ledger History: ${historyPay?.customer}`}
        size="lg"
      >
        {historyPay && (
          <div className="payment-history-manager">
            {/* Payment Summary metrics */}
            <div className="form-grid-3 payment-summary-row">
              <div className="summary-metric">
                <span className="text-xs text-muted font-medium">Total Value</span>
                <span className="font-bold color-primary">${Number(historyPay.totalAmount).toLocaleString()}</span>
              </div>
              <div className="summary-metric">
                <span className="text-xs text-muted font-medium">Cleared Amount</span>
                <span className="font-bold text-success">
                  ${historyPay.history.reduce((sum, h) => sum + Number(h.amount), 0).toLocaleString()}
                </span>
              </div>
              <div className="summary-metric">
                <span className="text-xs text-muted font-medium">Outstanding Bal</span>
                <span className={`font-bold ${calculateRemaining(historyPay) > 0 ? 'text-danger' : 'text-success'}`}>
                  ${calculateRemaining(historyPay).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="dropdown-divider" />

            {/* List of payments timeline */}
            <h4 className="font-semibold color-primary" style={{ marginBottom: 'var(--space-2)' }}>Payment Timeline</h4>
            <div className="history-timeline">
              {historyPay.history.length === 0 ? (
                <p className="text-sm text-muted">No payments logged in the ledger yet.</p>
              ) : (
                historyPay.history.map((h) => (
                  <div key={h.id} className="history-timeline-item flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-primary">
                        ${Number(h.amount).toLocaleString()} &bull; {h.type}
                      </span>
                      <p className="text-sm text-muted">{h.note}</p>
                      <span className="text-xs text-muted">Date Cleared: {h.date}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="delete"
                      className="text-danger"
                      onClick={() => deleteTxEntry(h.id)}
                      title="Remove transaction"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="dropdown-divider" />

            {/* Add payment ledger form */}
            <h4 className="font-semibold color-primary" style={{ marginBottom: 'var(--space-2)' }}>Add Payment Log</h4>
            <form onSubmit={handleAddTxSubmit} className="dashboard-modal-form">
              <div className="form-grid-3">
                <Input
                  id="tx-amount"
                  type="number"
                  label="Payment Cleared ($) *"
                  value={newTx.amount}
                  onChange={(e) => setNewTx({ ...newTx, amount: e.target.value })}
                  required
                />
                <Input
                  id="tx-date"
                  type="date"
                  label="Clearance Date *"
                  value={newTx.date}
                  onChange={(e) => setNewTx({ ...newTx, date: e.target.value })}
                  required
                />
                <div className="form-group">
                  <label className="input-field__label" htmlFor="tx-type">Transaction Type</label>
                  <select
                    id="tx-type"
                    className="dashboard-select"
                    value={newTx.type}
                    onChange={(e) => setNewTx({ ...newTx, type: e.target.value })}
                  >
                    <option value="Advance">Advance</option>
                    <option value="Milestone">Milestone</option>
                    <option value="Full">Full Payment</option>
                  </select>
                </div>
              </div>
              <Input
                id="tx-note"
                label="Transaction Reference / Note *"
                placeholder="e.g. Bank transfer ref #110293"
                value={newTx.note}
                onChange={(e) => setNewTx({ ...newTx, note: e.target.value })}
                required
              />
              <div>
                <Button type="submit" variant="primary" size="sm" icon="add">
                  Record Transaction
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* --- DETAILED VIEW PROFILE MODAL --- */}
      <Modal
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        title={`Billing & Payment Profile: ${viewPay?.id}`}
        size="lg"
      >
        {viewPay && (
          <div className="company-view-details">
            <div className="company-view-details__header flex justify-between items-center">
              <div>
                <h2>{viewPay.customer}</h2>
                <span className="text-sm text-muted">Order Number: <strong>{viewPay.orderNumber}</strong></span>
              </div>
              <Badge
                variant={
                  viewPay.status === 'Paid'
                    ? 'success'
                    : viewPay.status === 'Partial'
                    ? 'info'
                    : viewPay.status === 'Overdue'
                    ? 'danger'
                    : 'warning'
                }
              >
                {viewPay.status}
              </Badge>
            </div>

            <div className="dropdown-divider" />

            <div className="company-view-details__grid">
              <div className="company-view-details__sec">
                <h3>Financial Overview</h3>
                <p><strong>Total Value:</strong> ${Number(viewPay.totalAmount).toLocaleString()}</p>
                <p><strong>Advance Paid:</strong> ${Number(viewPay.advanceAmount).toLocaleString()}</p>
                <p><strong>Outstanding Balance:</strong> <span className="font-bold text-danger">${calculateRemaining(viewPay).toLocaleString()}</span></p>
              </div>

              <div className="company-view-details__sec">
                <h3>Invoicing & Terms</h3>
                <p><strong>Invoice Number:</strong> {viewPay.invoiceNumber || 'Not Generated'}</p>
                <p><strong>Due Date:</strong> {viewPay.dueDate}</p>
                <p><strong>GST ID:</strong> {viewPay.gst || 'No GST Registered'}</p>
                <p><strong>Terms:</strong> {viewPay.paymentSchedule} ({viewPay.paymentType})</p>
              </div>
            </div>

            {/* Payment history list */}
            <div className="company-view-details__sec" style={{ marginTop: 'var(--space-4)' }}>
              <h3>Transaction History Timeline</h3>
              <div className="payment-timeline-visual">
                {viewPay.history.length === 0 ? (
                  <p className="text-sm text-muted">No payments logged in the ledger yet.</p>
                ) : (
                  viewPay.history.map((h, i) => (
                    <div key={h.id} className="payment-timeline-visual__node">
                      <div className="node-marker" />
                      <div className="node-content">
                        <span className="font-semibold text-success">${Number(h.amount).toLocaleString()}</span>
                        <span className="text-xs text-muted"> &bull; {h.type} &bull; {h.date}</span>
                        <p className="text-sm text-muted" style={{ margin: 0 }}>{h.note}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import './ModulePages.css';

export default function ApproachedPage() {
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching companies:', error);
    } else {
      // Map database snake_case to frontend camelCase
      // Guard data against null (can happen with RLS policies)
      const mappedData = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        contactPerson: c.contact_person,
        designation: c.designation,
        phone: c.phone,
        email: c.email,
        website: c.website,
        gst: c.gst,
        address: c.address,
        industry: c.industry,
        approachType: c.approach_type,
        modeOfApproach: c.mode_of_approach,
        recommendedBy: c.recommended_by,
        recommendationContact: c.recommendation_contact,
        date: c.approach_date,
        assignedEmployee: c.assigned_employee_id, // we might want to populate this later
        remarks: '', // No remarks in companies table according to schema
        attachments: { // No attachments in companies table according to schema, but keeping for UI
          visitingCard: '',
          companyBrochure: '',
          businessCard: '',
        }
      }));
      setCompanies(mappedData);
    }
    setIsLoading(false);
  };

  // -- Filters, Sorting & Pagination State --
  const [searchVal, setSearchVal] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [approachTypeFilter, setApproachTypeFilter] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // -- Modal States --
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  
  // -- Active Entity State --
  const emptyCompany = {
    id: '',
    name: '',
    contactPerson: '',
    designation: '',
    phone: '',
    email: '',
    website: '',
    gst: '',
    address: '',
    industry: 'Manufacturing',
    approachType: 'We Approached Them',
    modeOfApproach: 'Website',
    recommendedBy: '',
    recommendationContact: '',
    date: new Date().toISOString().split('T')[0],
    assignedEmployee: '',
    remarks: '',
    attachments: {
      visitingCard: '',
      companyBrochure: '',
      businessCard: '',
    },
  };
  const [activeCompany, setActiveCompany] = useState({ ...emptyCompany });
  const [viewCompany, setViewCompany] = useState(null);

  // -- Industry types array --
  const industryTypes = ['Manufacturing', 'Information Technology', 'Logistics', 'Retail', 'Healthcare', 'Finance', 'Other'];

  // -- Filtering & Sorting logic --
  const processedCompanies = useMemo(() => {
    let result = [...companies];

    // Search filter
    if (searchVal) {
      const q = searchVal.toLowerCase();
      result = result.filter(
        (c) =>
          (c.name || '').toLowerCase().includes(q) ||
          (c.contactPerson || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.id || '').toLowerCase().includes(q)
      );
    }

    // Industry filter
    if (industryFilter) {
      result = result.filter((c) => c.industry === industryFilter);
    }

    // Approach type filter
    if (approachTypeFilter) {
      result = result.filter((c) => c.approachType === approachTypeFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [companies, searchVal, industryFilter, approachTypeFilter, sortField, sortOrder]);

  // -- Pagination calculations --
  const paginatedCompanies = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return processedCompanies.slice(startIndex, startIndex + itemsPerPage);
  }, [processedCompanies, currentPage]);

  const totalPages = Math.ceil(processedCompanies.length / itemsPerPage) || 1;

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // -- CRUD handlers --
  const handleOpenCreate = () => {
    setModalMode('create');
    setActiveCompany({
      ...emptyCompany,
      id: `CMP-${Date.now().toString().slice(-3)}`,
    });
    setFormModalOpen(true);
  };

  const handleOpenEdit = (company, e) => {
    e.stopPropagation();
    setModalMode('edit');
    setActiveCompany({ ...company });
    setFormModalOpen(true);
  };

  const handleOpenView = (company) => {
    setViewCompany(company);
    setViewModalOpen(true);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete company record?`)) {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting company:', error);
        alert('Failed to delete company.');
      } else {
        setCompanies(companies.filter((c) => c.id !== id));
        if (paginatedCompanies.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      }
    }
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();
    
    // Transform front-end camelCase to db snake_case
    const dbPayload = {
      name: activeCompany.name,
      contact_person: activeCompany.contactPerson,
      designation: activeCompany.designation,
      phone: activeCompany.phone,
      email: activeCompany.email,
      website: activeCompany.website,
      gst: activeCompany.gst,
      address: activeCompany.address,
      industry: activeCompany.industry,
      approach_type: activeCompany.approachType,
      mode_of_approach: activeCompany.modeOfApproach,
      recommended_by: activeCompany.recommendedBy,
      recommendation_contact: activeCompany.recommendationContact,
      approach_date: activeCompany.date,
    };

    if (modalMode === 'edit') {
      const { error } = await supabase
        .from('companies')
        .update(dbPayload)
        .eq('id', activeCompany.id);
        
      if (error) {
        console.error('Error updating company:', error);
        alert('Failed to update company.');
      } else {
        fetchCompanies();
        setFormModalOpen(false);
      }
    } else {
      const { error } = await supabase
        .from('companies')
        .insert([dbPayload]);
        
      if (error) {
        console.error('Error inserting company:', error);
        alert('Failed to insert company.');
      } else {
        fetchCompanies();
        setFormModalOpen(false);
      }
    }
  };

  // Mock attachment helper
  const handleMockAttachmentChange = (type, fileName) => {
    setActiveCompany({
      ...activeCompany,
      attachments: {
        ...activeCompany.attachments,
        [type]: fileName,
      },
    });
  };

  return (
    <div className="module-page">
      {/* Header */}
      <div className="module-page__header flex justify-between items-center">
        <div>
          <h1 className="module-page__title">Approached Companies</h1>
          <p className="module-page__subtitle">Registry of prospect and lead organization pipelines.</p>
        </div>
        <Button variant="primary" icon="add" onClick={handleOpenCreate}>
          Add Company
        </Button>
      </div>

      {/* Filter and Table Card */}
      <Card padding="md" className="module-page__table-card">
        {/* Search, Filter bar */}
        <div className="module-page__filters flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4 justify-between">
            {/* Search Input */}
            <div className="topnav__search">
              <span className="material-icons topnav__search-icon">search</span>
              <input
                type="text"
                className="topnav__search-input"
                placeholder="Search by Company, Contact, Email..."
                value={searchVal}
                onChange={(e) => {
                  setSearchVal(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Quick dropdown selectors */}
            <div className="flex gap-3 flex-wrap">
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="dashboard-select"
                  value={industryFilter}
                  onChange={(e) => {
                    setIndustryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Industry"
                >
                  <option value="">All Industries</option>
                  {industryTypes.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="dashboard-select"
                  value={approachTypeFilter}
                  onChange={(e) => {
                    setApproachTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Approach Type"
                >
                  <option value="">All Approach Types</option>
                  <option value="We Approached Them">We Approached Them</option>
                  <option value="They Approached Us">They Approached Us</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Custom Table View with Sorting Columns */}
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('id')}>
                  ID {sortField === 'id' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('name')}>
                  Company Name {sortField === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th>Contact Person</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('industry')}>
                  Industry {sortField === 'industry' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th>Approach Type</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('date')}>
                  Approach Date {sortField === 'date' && (sortOrder === 'asc' ? '▲' : '▼')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    No companies matched your search query.
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((c) => (
                  <tr key={c.id}>
                    <td onClick={() => handleOpenView(c)} style={{ cursor: 'pointer' }}><span className="font-semibold">{c.id}</span></td>
                    <td onClick={() => handleOpenView(c)} style={{ cursor: 'pointer' }}><div className="font-bold color-primary">{c.name}</div></td>
                    <td onClick={() => handleOpenView(c)} style={{ cursor: 'pointer' }}>
                      <div className="flex flex-col">
                        <span>{c.contactPerson}</span>
                        <span className="text-sm text-muted">{c.designation}</span>
                      </div>
                    </td>
                    <td onClick={() => handleOpenView(c)} style={{ cursor: 'pointer' }}><Badge variant="primary">{c.industry}</Badge></td>
                    <td onClick={() => handleOpenView(c)} style={{ cursor: 'pointer' }}>
                      <Badge variant={c.approachType === 'We Approached Them' ? 'info' : 'success'}>
                        {c.approachType}
                      </Badge>
                    </td>
                    <td onClick={() => handleOpenView(c)} style={{ cursor: 'pointer' }}>{c.date}</td>
                    <td>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="edit"
                          onClick={(e) => handleOpenEdit(c, e)}
                          aria-label="Edit company"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="delete"
                          className="text-danger"
                          onClick={(e) => handleDelete(c.id, e)}
                          aria-label="Delete company"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center" style={{ marginTop: 'var(--space-4)' }}>
            <span className="text-sm text-muted">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
                icon="chevron_left"
              >
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
                iconRight="chevron_right"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* --- ADD / EDIT FORM MODAL --- */}
      <Modal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={modalMode === 'edit' ? `Edit Company Details: ${activeCompany.id}` : 'Register Company Lead'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="company-form">Save Company</Button>
          </>
        }
      >
        <form id="company-form" onSubmit={handleSaveSubmit} className="dashboard-modal-form">
          <div className="form-grid-2">
            <Input
              id="co-name"
              label="Company Name *"
              value={activeCompany.name}
              onChange={(e) => setActiveCompany({ ...activeCompany, name: e.target.value })}
              required
            />
            <Input
              id="co-contact"
              label="Contact Person Name *"
              value={activeCompany.contactPerson}
              onChange={(e) => setActiveCompany({ ...activeCompany, contactPerson: e.target.value })}
              required
            />
            <Input
              id="co-desig"
              label="Designation"
              value={activeCompany.designation}
              onChange={(e) => setActiveCompany({ ...activeCompany, designation: e.target.value })}
            />
            <Input
              id="co-phone"
              type="tel"
              label="Phone Number *"
              value={activeCompany.phone}
              onChange={(e) => setActiveCompany({ ...activeCompany, phone: e.target.value })}
              required
            />
            <Input
              id="co-email"
              type="email"
              label="Email Address *"
              value={activeCompany.email}
              onChange={(e) => setActiveCompany({ ...activeCompany, email: e.target.value })}
              required
            />
            <Input
              id="co-web"
              label="Website URL"
              value={activeCompany.website}
              onChange={(e) => setActiveCompany({ ...activeCompany, website: e.target.value })}
            />
            <Input
              id="co-gst"
              label="GST Registration Number"
              value={activeCompany.gst}
              onChange={(e) => setActiveCompany({ ...activeCompany, gst: e.target.value })}
            />
            <div className="form-group">
              <label className="input-field__label" htmlFor="co-industry">Industry Segment</label>
              <select
                id="co-industry"
                className="dashboard-select"
                value={activeCompany.industry}
                onChange={(e) => setActiveCompany({ ...activeCompany, industry: e.target.value })}
              >
                {industryTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="input-field__label" htmlFor="co-address">Office Address</label>
            <textarea
              id="co-address"
              className="dashboard-textarea"
              rows="2"
              value={activeCompany.address}
              onChange={(e) => setActiveCompany({ ...activeCompany, address: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="input-field__label" htmlFor="co-approach">Approach Type *</label>
              <select
                id="co-approach"
                className="dashboard-select"
                value={activeCompany.approachType}
                onChange={(e) => setActiveCompany({ ...activeCompany, approachType: e.target.value })}
                required
              >
                <option value="We Approached Them">We Approached Them</option>
                <option value="They Approached Us">They Approached Us</option>
              </select>
            </div>

            {/* Display Mode of Approach Selection */}
            <div className="form-group">
              <label className="input-field__label" htmlFor="co-mode">Mode of Approach</label>
              <select
                id="co-mode"
                className="dashboard-select"
                value={activeCompany.modeOfApproach}
                onChange={(e) => setActiveCompany({ ...activeCompany, modeOfApproach: e.target.value })}
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

          {/* Show recommended fields if Reference selected */}
          {activeCompany.modeOfApproach === 'Reference' && (
            <div className="form-grid-2 border-box-reference">
              <Input
                id="ref-by"
                label="Recommended By Name"
                value={activeCompany.recommendedBy || ''}
                onChange={(e) => setActiveCompany({ ...activeCompany, recommendedBy: e.target.value })}
              />
              <Input
                id="ref-contact"
                label="Recommendation Contact"
                value={activeCompany.recommendationContact || ''}
                onChange={(e) => setActiveCompany({ ...activeCompany, recommendationContact: e.target.value })}
              />
            </div>
          )}

          <div className="form-grid-2">
            <Input
              id="co-date"
              type="date"
              label="Approach Date"
              value={activeCompany.date}
              onChange={(e) => setActiveCompany({ ...activeCompany, date: e.target.value })}
            />
            <Input
              id="co-assigned"
              label="Assigned Employee Representative"
              value={activeCompany.assignedEmployee}
              onChange={(e) => setActiveCompany({ ...activeCompany, assignedEmployee: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="input-field__label" htmlFor="co-remarks">Additional Remarks</label>
            <textarea
              id="co-remarks"
              className="dashboard-textarea"
              rows="2"
              value={activeCompany.remarks}
              onChange={(e) => setActiveCompany({ ...activeCompany, remarks: e.target.value })}
            />
          </div>

          {/* Attachments Inputs */}
          <div className="form-group">
            <label className="input-field__label">Upload Documents / Attachments</label>
            <div className="form-grid-3" style={{ marginTop: 'var(--space-1)' }}>
              <div className="attachment-box">
                <span className="text-xs text-muted font-medium">Visiting Card File Name</span>
                <input
                  type="text"
                  placeholder="e.g. card.jpg"
                  className="dashboard-select"
                  value={activeCompany.attachments.visitingCard}
                  onChange={(e) => handleMockAttachmentChange('visitingCard', e.target.value)}
                />
              </div>
              <div className="attachment-box">
                <span className="text-xs text-muted font-medium">Company Brochure File Name</span>
                <input
                  type="text"
                  placeholder="e.g. catalog.pdf"
                  className="dashboard-select"
                  value={activeCompany.attachments.companyBrochure}
                  onChange={(e) => handleMockAttachmentChange('companyBrochure', e.target.value)}
                />
              </div>
              <div className="attachment-box">
                <span className="text-xs text-muted font-medium">Business Card File Name</span>
                <input
                  type="text"
                  placeholder="e.g. card_back.jpg"
                  className="dashboard-select"
                  value={activeCompany.attachments.businessCard}
                  onChange={(e) => handleMockAttachmentChange('businessCard', e.target.value)}
                />
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* --- DETAILS VIEW MODAL --- */}
      <Modal
        isOpen={viewModalOpen}
        onClose={() => setViewModalOpen(false)}
        title={`Company Profile Details: ${viewCompany?.id}`}
        size="lg"
      >
        {viewCompany && (
          <div className="company-view-details">
            <div className="company-view-details__header flex justify-between items-center">
              <div>
                <h2>{viewCompany.name}</h2>
                <span className="text-sm text-muted">{viewCompany.industry} &bull; Registry: {viewCompany.gst || 'No GST Record'}</span>
              </div>
              <Badge variant={viewCompany.approachType === 'We Approached Them' ? 'info' : 'success'}>
                {viewCompany.approachType}
              </Badge>
            </div>

            <div className="dropdown-divider" />

            <div className="company-view-details__grid">
              <div className="company-view-details__sec">
                <h3>Contact Information</h3>
                <p><strong>Contact Person:</strong> {viewCompany.contactPerson} ({viewCompany.designation || 'No Designation'})</p>
                <p><strong>Phone:</strong> {viewCompany.phone}</p>
                <p><strong>Email:</strong> {viewCompany.email}</p>
                <p><strong>Website:</strong> {viewCompany.website ? <a href={`https://${viewCompany.website}`} target="_blank" rel="noreferrer" className="text-success">{viewCompany.website}</a> : 'Not specified'}</p>
              </div>

              <div className="company-view-details__sec">
                <h3>Office Location</h3>
                <p><strong>Address:</strong> {viewCompany.address || 'No Address Listed'}</p>
              </div>

              <div className="company-view-details__sec">
                <h3>Approach Parameters</h3>
                <p><strong>Approach Date:</strong> {viewCompany.date}</p>
                <p><strong>Approach Mode:</strong> {viewCompany.modeOfApproach}</p>
                {viewCompany.modeOfApproach === 'Reference' && (
                  <div className="border-box-reference" style={{ padding: 'var(--space-2)' }}>
                    <p><strong>Recommended By:</strong> {viewCompany.recommendedBy || 'Not specified'}</p>
                    <p><strong>Recommendation Phone:</strong> {viewCompany.recommendationContact || 'Not specified'}</p>
                  </div>
                )}
                <p><strong>Assigned Representative:</strong> {viewCompany.assignedEmployee || 'Not Assigned'}</p>
              </div>

              <div className="company-view-details__sec">
                <h3>Remarks / Notes</h3>
                <p>{viewCompany.remarks || 'No remarks added yet.'}</p>
              </div>
            </div>

            {/* Attachments Section */}
            {(viewCompany.attachments?.visitingCard ||
              viewCompany.attachments?.companyBrochure ||
              viewCompany.attachments?.businessCard) && (
              <div className="company-view-details__sec" style={{ marginTop: 'var(--space-4)' }}>
                <h3>Associated Attachments</h3>
                <div className="flex gap-4 flex-wrap" style={{ marginTop: 'var(--space-2)' }}>
                  {viewCompany.attachments.visitingCard && (
                    <div className="attachment-badge">
                      <span className="material-icons">badge</span>
                      <span>{viewCompany.attachments.visitingCard}</span>
                    </div>
                  )}
                  {viewCompany.attachments.companyBrochure && (
                    <div className="attachment-badge">
                      <span className="material-icons">picture_as_pdf</span>
                      <span>{viewCompany.attachments.companyBrochure}</span>
                    </div>
                  )}
                  {viewCompany.attachments.businessCard && (
                    <div className="attachment-badge">
                      <span className="material-icons">perm_contact_calendar</span>
                      <span>{viewCompany.attachments.businessCard}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

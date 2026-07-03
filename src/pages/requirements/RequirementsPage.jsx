import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { syncCompanyOrders } from '../../services/sheetsSyncService';
import { logCompanyTimelineEvents } from '../../services/timelineService';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import FileUpload from '../../components/common/FileUpload';
import '../approached/ModulePages.css';

export default function RequirementsPage() {
  const [companies, setCompanies] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch companies for the select dropdown
    const { data: companiesData, error: compError } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');
      
    if (compError) {
      console.error('Error fetching companies:', compError);
    } else {
      setCompanies(companiesData || []);
    }

    // Fetch active requirement templates
    const { data: templatesData } = await supabase
      .from('requirement_templates')
      .select('*')
      .eq('status', 'Active')
      .order('name');
    if (templatesData) setTemplates(templatesData);

    // Fetch requirements with company name joined
    const { data: reqData, error: reqError } = await supabase
      .from('requirements')
      .select(`
        *,
        companies (
          name
        )
      `)
      .order('created_at', { ascending: false });

    if (reqError) {
      console.error('Error fetching requirements:', reqError);
    } else {
      const mappedReqs = reqData.map(r => ({
        id: r.id,
        companyId: r.company_id,
        companyName: r.companies?.name || 'Unknown Company',
        title: r.title,
        meetingType: r.meeting_type,
        meetingDate: r.meeting_date,
        meetingTime: r.meeting_time,
        meetingLink: r.meeting_link,
        meetingLocation: r.meeting_location,
        employeesPresent: r.employees_present,
        customerReps: r.customer_reps,
        description: r.description,
        material: r.material,
        quantity: r.quantity,
        requiredDeliveryDate: r.required_delivery_date,
        priority: r.priority,
        expectedBudget: r.expected_budget,
        fileOption: r.file_option,
        customFileName: r.custom_file_name,
        attachments: r.attachments || {
          images: '',
          drawings: '',
          pdf: '',
          cadFiles: '',
          videos: '',
          voiceNotes: '',
        },
        meetingNotes: r.meeting_notes,
        status: r.status,
        templateId: r.template_id ? r.template_id : 'other',
        customTitle: r.template_id ? '' : r.title,
        dynamicResponses: r.dynamic_responses || {},
      }));
      setRequirements(mappedReqs);
    }
    
    setIsLoading(false);
  };

  // -- Table Controls State --
  const [searchVal, setSearchVal] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'

  const emptyRequirement = {
    id: '',
    companyId: '',
    companyName: '',
    title: '',
    meetingType: 'Online',
    meetingDate: '',
    meetingTime: '',
    meetingLink: '',
    meetingLocation: '',
    employeesPresent: '',
    customerReps: '',
    description: '',
    material: '',
    quantity: '',
    requiredDeliveryDate: '',
    priority: 'Medium',
    expectedBudget: '',
    fileOption: 'Keep Original Filename',
    customFileName: '',
    attachments: {
      images: [],
      drawings: [],
      pdf: [],
      cadFiles: [],
      videos: [],
      voiceNotes: [],
    },
    meetingNotes: '',
    status: 'Draft',
    templateId: '',
    customTitle: '',
    dynamicResponses: {},
  };

  const [activeReq, setActiveReq] = useState({ ...emptyRequirement });
  const [viewReq, setViewReq] = useState(null);

  // -- Filters --
  const filteredReqs = useMemo(() => {
    return requirements.filter((r) => {
      const matchSearch =
        r.companyName.toLowerCase().includes(searchVal.toLowerCase()) ||
        r.title.toLowerCase().includes(searchVal.toLowerCase()) ||
        r.id.toLowerCase().includes(searchVal.toLowerCase());
      const matchStatus = statusFilter ? r.status === statusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [requirements, searchVal, statusFilter]);

  // -- Handlers --
  const openCreateModal = () => {
    setModalMode('create');
    setActiveReq({
      ...emptyRequirement,
      id: `REQ-${Date.now().toString().slice(-3)}`,
      meetingDate: new Date().toISOString().split('T')[0],
    });
    setModalOpen(true);
  };

  const openEditModal = (req, e) => {
    e.stopPropagation();
    setModalMode('edit');
    setActiveReq({ ...req });
    setModalOpen(true);
  };

  const openViewModal = (req) => {
    setViewReq(req);
    setViewOpen(true);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete requirement?`)) {
      const { error } = await supabase
        .from('requirements')
        .delete()
        .eq('id', id);
        
      if (error) {
        console.error('Error deleting requirement:', error);
        alert('Failed to delete requirement.');
      } else {
        fetchData();
      }
    }
  };

  const handleSaveSubmit = async (e) => {
    e.preventDefault();

    // Support validation according to status
    if (activeReq.status !== 'Draft') {
      if (!activeReq.description?.trim()) {
        alert('Requirement Description / Scope Details is required.');
        return;
      }
      
      if (activeReq.templateId && activeReq.templateId !== 'other') {
        const activeTpl = templates.find(t => t.id === activeReq.templateId);
        if (activeTpl && activeTpl.fields) {
          for (const field of activeTpl.fields) {
            if (field.required) {
              const val = activeReq.dynamicResponses[field.name];
              if (val === undefined || val === null || val.toString().trim() === '') {
                alert(`The custom field "${field.name}" is required.`);
                return;
              }
            }
          }
        }
      }
    }

    // Process file renaming logic if selected.
    // NOTE: Attachment values can be either a string URL or an array of URLs.
    // We safely guard both cases to prevent .split() crash on arrays.
    let processedAttachments = { ...activeReq.attachments };
    if (activeReq.fileOption === 'Rename File' && activeReq.customFileName) {
      const baseName = activeReq.customFileName;
      Object.keys(processedAttachments).forEach((key) => {
        const val = processedAttachments[key];
        if (val && typeof val === 'string' && val.trim()) {
          const extension = val.split('.').pop();
          processedAttachments[key] = `${baseName}_${key}.${extension}`;
        }
        // Arrays of URLs — skip renaming (URLs are immutable after upload)
      });
    } else if (activeReq.fileOption === 'Auto Rename') {
      const stamp = Date.now();
      const prefix = activeReq.companyName ? activeReq.companyName.toLowerCase().replace(/\s+/g, '_') : 'req';
      Object.keys(processedAttachments).forEach((key) => {
        const val = processedAttachments[key];
        if (val && typeof val === 'string' && val.trim()) {
          const extension = val.split('.').pop();
          processedAttachments[key] = `${prefix}_${key}_${stamp}.${extension}`;
        }
        // Arrays of URLs — skip renaming (URLs are immutable after upload)
      });
    }

    const finalTitle = activeReq.templateId === 'other' ? activeReq.customTitle : activeReq.title;
    const finalTemplateId = activeReq.templateId === 'other' ? null : activeReq.templateId;

    const dbPayload = {
      company_id: activeReq.companyId,
      title: finalTitle,
      meeting_type: activeReq.meetingType,
      meeting_date: activeReq.meetingDate || null,
      meeting_time: activeReq.meetingTime,
      meeting_link: activeReq.meetingLink,
      meeting_location: activeReq.meetingLocation,
      employees_present: activeReq.employeesPresent,
      customer_reps: activeReq.customerReps,
      description: activeReq.description,
      material: activeReq.material,
      quantity: activeReq.quantity,
      required_delivery_date: activeReq.requiredDeliveryDate || null,
      priority: activeReq.priority,
      expected_budget: activeReq.expectedBudget,
      file_option: activeReq.fileOption,
      custom_file_name: activeReq.customFileName,
      meeting_notes: activeReq.meetingNotes,
      status: activeReq.status,
      attachments: processedAttachments,
      template_id: finalTemplateId || null,
      dynamic_responses: activeReq.dynamicResponses || {},
    };

    if (modalMode === 'edit') {
      const { error } = await supabase
        .from('requirements')
        .update(dbPayload)
        .eq('id', activeReq.id);
        
      if (error) {
        console.error('Error updating requirement:', error);
        alert('Failed to update requirement.');
      } else {
        fetchData();
        setModalOpen(false);
        syncCompanyOrders(dbPayload.company_id);
        
        // Log to timeline
        logCompanyTimelineEvents(dbPayload.company_id, {
          action: 'Requirement Updated',
          remarks: `Requirement "${dbPayload.title}" details modified.`
        });
      }
    } else {
      const { error } = await supabase
        .from('requirements')
        .insert([dbPayload]);
        
      if (error) {
        console.error('Error inserting requirement:', error);
        alert('Failed to insert requirement.');
      } else {
        fetchData();
        setModalOpen(false);
        syncCompanyOrders(dbPayload.company_id);

        // Log to timeline
        logCompanyTimelineEvents(dbPayload.company_id, {
          action: 'Requirement Created',
          remarks: `New requirement template loaded and recorded for title: "${dbPayload.title}".`
        });

        // Log drawings and files if any
        const drawings = dbPayload.attachments?.drawings || [];
        const images = dbPayload.attachments?.images || [];
        const pdfs = dbPayload.attachments?.pdf || [];
        const cads = dbPayload.attachments?.cadFiles || [];
        const videos = dbPayload.attachments?.videos || [];
        const voices = dbPayload.attachments?.voiceNotes || [];

        if (drawings.length > 0) {
          logCompanyTimelineEvents(dbPayload.company_id, {
            action: 'Drawing Uploaded',
            remarks: `Initial drawings uploaded.`,
            relatedFiles: drawings
          });
        }

        const others = [...images, ...pdfs, ...cads, ...videos, ...voices];
        if (others.length > 0) {
          logCompanyTimelineEvents(dbPayload.company_id, {
            action: 'Files Added',
            remarks: `Additional scope attachments added.`,
            relatedFiles: others
          });
        }
      }
    }
  };

  const handleAttachmentFieldChange = (type, val) => {
    const current = activeReq.attachments?.[type];
    let updated;
    if (Array.isArray(current)) {
      updated = [...current, val];
    } else if (current && typeof current === 'string' && current.trim() !== '') {
      updated = [current, val];
    } else {
      updated = [val];
    }

    setActiveReq({
      ...activeReq,
      attachments: {
        ...activeReq.attachments,
        [type]: updated,
      },
    });
  };

  const renderAttachmentLinks = (fieldVal) => {
    if (!fieldVal) return null;
    const vals = Array.isArray(fieldVal) ? fieldVal : [fieldVal];
    return vals.map((url, idx) => {
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return url ? <span key={idx}>{url}</span> : null;
      }
      return (
        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="underline text-success block truncate" style={{ maxWidth: '180px' }}>
          File #{idx + 1}
        </a>
      );
    });
  };

  const isSection1Valid = () => {
    const req = activeReq;
    const isTitleValid = req.templateId === 'other' ? req.customTitle?.trim() : req.templateId;
    const isLocationOrLinkValid = req.meetingType === 'Online' ? req.meetingLink?.trim() : req.meetingLocation?.trim();
    
    return (
      req.companyId &&
      isTitleValid &&
      req.meetingType &&
      req.meetingDate &&
      req.meetingTime &&
      isLocationOrLinkValid &&
      req.employeesPresent?.trim()
    );
  };
  const calculateFormProgress = () => {
    if (!isSection1Valid()) return 0;
    
    if (activeReq.templateId === 'other') {
      const fieldsToCheck = [
        activeReq.description,
        activeReq.material,
        activeReq.quantity,
        activeReq.requiredDeliveryDate,
        activeReq.priority,
        activeReq.expectedBudget
      ];
      const filled = fieldsToCheck.filter(f => f && f.toString().trim() !== '').length;
      return Math.round((filled / fieldsToCheck.length) * 100);
    } else {
      const activeTpl = templates.find(t => t.id === activeReq.templateId);
      if (!activeTpl || !activeTpl.fields || activeTpl.fields.length === 0) return 0;
      
      const totalFields = activeTpl.fields.length;
      let filledFields = 0;
      activeTpl.fields.forEach(f => {
        const val = activeReq.dynamicResponses[f.name];
        if (val !== undefined && val !== null && val.toString().trim() !== '') {
          filledFields++;
        }
      });
      return Math.round((filledFields / totalFields) * 100);
    }
  };

  const handleTemplateChange = (e) => {
    const tplId = e.target.value;
    if (tplId === 'other') {
      setActiveReq({
        ...activeReq,
        templateId: 'other',
        title: 'Other Requirement',
        customTitle: '',
        dynamicResponses: {}
      });
      return;
    }
    
    const selectedTpl = templates.find(t => t.id === tplId);
    
    // Initialize empty responses for the template fields
    const newResponses = {};
    if (selectedTpl && selectedTpl.fields) {
      selectedTpl.fields.forEach(f => {
        newResponses[f.name] = f.defaultValue || '';
      });
    }
    
    setActiveReq({
      ...activeReq,
      templateId: tplId,
      title: selectedTpl ? selectedTpl.name : '',
      customTitle: '',
      dynamicResponses: newResponses
    });
  };

  const renderDynamicFields = () => {
    const activeTpl = templates.find(t => t.id === activeReq.templateId);
    if (!activeTpl || !activeTpl.fields) return null;

    const handleDynamicValueChange = (fieldName, val) => {
      setActiveReq(prev => ({
        ...prev,
        dynamicResponses: {
          ...prev.dynamicResponses,
          [fieldName]: val
        }
      }));
    };

    return activeTpl.fields.map((field) => {
      const currentVal = activeReq.dynamicResponses[field.name] || '';

      if (field.type === 'paragraph') {
        return (
          <div className="form-group span-2" key={field.id} style={{ gridColumn: 'span 2' }}>
            <label className="input-field__label">{field.name} {field.required && '*'}</label>
            <textarea
              className="dashboard-textarea"
              placeholder={field.placeholder}
              value={currentVal}
              onChange={(e) => handleDynamicValueChange(field.name, e.target.value)}
              required={field.required}
            />
            {field.helpText && <span className="text-xs text-muted block" style={{ marginTop: '2px' }}>{field.helpText}</span>}
          </div>
        );
      }

      if (field.type === 'dropdown') {
        const options = (field.dropdownValues || '').split(',').map(o => o.trim()).filter(Boolean);
        return (
          <div className="form-group" key={field.id}>
            <label className="input-field__label">{field.name} {field.required && '*'}</label>
            <select
              className="dashboard-select"
              value={currentVal}
              onChange={(e) => handleDynamicValueChange(field.name, e.target.value)}
              required={field.required}
            >
              <option value="">-- Select option --</option>
              {options.map((opt, oIdx) => (
                <option key={oIdx} value={opt}>{opt}</option>
              ))}
            </select>
            {field.helpText && <span className="text-xs text-muted block" style={{ marginTop: '2px' }}>{field.helpText}</span>}
          </div>
        );
      }

      if (['text', 'number', 'date', 'time'].includes(field.type)) {
        return (
          <div className="form-group" key={field.id}>
            <Input
              id={`dyn-${field.id}`}
              type={field.type}
              label={`${field.name} ${field.required ? '*' : ''}`}
              placeholder={field.placeholder}
              value={currentVal}
              onChange={(e) => handleDynamicValueChange(field.name, e.target.value)}
              required={field.required}
            />
            {field.helpText && <span className="text-xs text-muted block" style={{ marginTop: '2px' }}>{field.helpText}</span>}
          </div>
        );
      }

      if (field.type === 'checkbox') {
        return (
          <div className="form-group flex items-center gap-2" style={{ marginTop: '24px' }} key={field.id}>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={!!currentVal}
                onChange={(e) => handleDynamicValueChange(field.name, e.target.checked)}
                required={field.required}
              />
              {field.name} {field.required && '*'}
            </label>
            {field.helpText && <span className="text-xs text-muted block">{field.helpText}</span>}
          </div>
        );
      }

      if (['file', 'multiple_files', 'image', 'drawing', 'pdf', 'cad', 'excel', 'video', 'voice'].includes(field.type)) {
        const isMultiple = field.type === 'multiple_files';
        
        const handleFileUploadSuccess = (url) => {
          if (isMultiple) {
            const currentList = Array.isArray(currentVal) ? currentVal : (currentVal ? [currentVal] : []);
            handleDynamicValueChange(field.name, [...currentList, url]);
          } else {
            handleDynamicValueChange(field.name, url);
          }
        };

        return (
          <div className="form-group" key={field.id}>
            <FileUpload
              label={`${field.name} ${field.required ? '*' : ''}`}
              onUploadSuccess={handleFileUploadSuccess}
            />
            <div className="uploaded-files flex flex-col gap-1 text-xs" style={{ marginTop: '4px' }}>
              {renderAttachmentLinks(currentVal)}
            </div>
            {field.helpText && <span className="text-xs text-muted block" style={{ marginTop: '2px' }}>{field.helpText}</span>}
          </div>
        );
      }

      return null;
    });
  };

  return (
    <div className="module-page">
      <div className="module-page__header flex justify-between items-center">
        <div>
          <h1 className="module-page__title">Project Requirements</h1>
          <p className="module-page__subtitle">Record customer scope discussions, capture specifications, and manage drafts.</p>
        </div>
        <Button variant="primary" icon="add" onClick={openCreateModal}>
          Add Requirement
        </Button>
      </div>

      <Card padding="md" className="module-page__table-card">
        {/* Filters */}
        <div className="module-page__filters flex items-center justify-between gap-4 flex-wrap">
          <div className="topnav__search">
            <span className="material-icons topnav__search-icon">search</span>
            <input
              type="text"
              className="topnav__search-input"
              placeholder="Search by ID, Company or Title..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <select
              className="dashboard-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
            >
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Under Discussion">Under Discussion</option>
              <option value="Ready for Manufacturer">Ready for Manufacturer</option>
            </select>
          </div>
        </div>

        {/* Table View */}
        <Table
          headers={['Req ID', 'Company Name', 'Requirement Title', 'Priority', 'Budget', 'Status', 'Actions']}
          data={filteredReqs}
          renderRow={(req) => (
            <tr key={req.id} style={{ cursor: 'pointer' }} onClick={() => openViewModal(req)}>
              <td><span className="font-semibold">{req.id}</span></td>
              <td><div className="font-bold color-primary">{req.companyName}</div></td>
              <td>{req.title}</td>
              <td>
                <Badge variant={req.priority === 'Critical' || req.priority === 'High' ? 'danger' : req.priority === 'Medium' ? 'warning' : 'info'}>
                  {req.priority}
                </Badge>
              </td>
              <td><span className="font-semibold text-success">{req.expectedBudget}</span></td>
              <td>
                <Badge variant={req.status === 'Ready for Manufacturer' ? 'success' : req.status === 'Under Discussion' ? 'info' : 'warning'}>
                  {req.status}
                </Badge>
              </td>
              <td>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" icon="edit" onClick={(e) => openEditModal(req, e)} aria-label="Edit requirement" />
                  <Button variant="ghost" size="sm" icon="delete" className="text-danger" onClick={(e) => handleDelete(req.id, e)} aria-label="Delete requirement" />
                </div>
              </td>
            </tr>
          )}
        />
      </Card>

      {/* --- ADD / EDIT FORM MODAL --- */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'edit' ? `Edit Requirement: ${activeReq.id}` : 'Record New Requirement'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="req-form">Save Requirement</Button>
          </>
        }
      >
        <form id="req-form" onSubmit={handleSaveSubmit} className="dashboard-modal-form">
          {/* SECTION 1: Meeting Information */}
          <div className="border-box-reference">
            <span className="text-sm font-semibold color-primary-light">Section 1: Meeting Information</span>
            <div className="form-grid-3" style={{ marginTop: 'var(--space-2)' }}>
              <div className="form-group">
                <label className="input-field__label" htmlFor="req-co-select">Select Company Name *</label>
                <select
                  id="req-co-select"
                  className="dashboard-select"
                  value={activeReq.companyId}
                  onChange={(e) => setActiveReq({ ...activeReq, companyId: e.target.value })}
                  required
                >
                  <option value="" disabled>Select a company</option>
                  {companies.map((co) => (
                    <option key={co.id} value={co.id}>{co.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="input-field__label" htmlFor="req-template-select">Requirement Title / Type *</label>
                <select
                  id="req-template-select"
                  className="dashboard-select"
                  value={activeReq.templateId}
                  onChange={handleTemplateChange}
                  required
                >
                  <option value="" disabled>-- Select Title/Type --</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                  ))}
                  <option value="other">Other Requirement</option>
                </select>
              </div>

              {activeReq.templateId === 'other' && (
                <Input
                  id="req-custom-title-input"
                  label="Custom Requirement Title *"
                  placeholder="Enter manual title..."
                  value={activeReq.customTitle || ''}
                  onChange={(e) => setActiveReq({ ...activeReq, customTitle: e.target.value })}
                  required
                />
              )}

              <div className="form-group">
                <label className="input-field__label" htmlFor="req-meet-type">Meeting Type *</label>
                <select
                  id="req-meet-type"
                  className="dashboard-select"
                  value={activeReq.meetingType}
                  onChange={(e) => setActiveReq({ ...activeReq, meetingType: e.target.value })}
                  required
                >
                  <option value="Online">Online Session</option>
                  <option value="Physical">Physical Meeting</option>
                </select>
              </div>

              <Input
                id="req-meet-date"
                type="date"
                label="Meeting Date *"
                value={activeReq.meetingDate}
                onChange={(e) => setActiveReq({ ...activeReq, meetingDate: e.target.value })}
                required
              />
              <Input
                id="req-meet-time"
                label="Meeting Time *"
                placeholder="e.g. 10:00 AM"
                value={activeReq.meetingTime}
                onChange={(e) => setActiveReq({ ...activeReq, meetingTime: e.target.value })}
                required
              />

              {activeReq.meetingType === 'Online' ? (
                <Input
                  id="req-meet-link"
                  label="Meeting Virtual Link *"
                  placeholder="e.g. https://meet.google.com/abc-defg-hij"
                  value={activeReq.meetingLink}
                  onChange={(e) => setActiveReq({ ...activeReq, meetingLink: e.target.value })}
                  required
                />
              ) : (
                <Input
                  id="req-meet-loc"
                  label="Physical Meeting Location *"
                  placeholder="e.g. Acme HQ Main Block"
                  value={activeReq.meetingLocation}
                  onChange={(e) => setActiveReq({ ...activeReq, meetingLocation: e.target.value })}
                  required
                />
              )}

              <Input
                id="req-meet-emp"
                label="Employees Present *"
                placeholder="e.g. Jane, Bob"
                value={activeReq.employeesPresent}
                onChange={(e) => setActiveReq({ ...activeReq, employeesPresent: e.target.value })}
                required
              />
              <Input
                id="req-meet-cust"
                label="Customer Representatives *"
                placeholder="e.g. Alice Smith"
                value={activeReq.customerReps}
                onChange={(e) => setActiveReq({ ...activeReq, customerReps: e.target.value })}
                required
              />
            </div>

            {/* Separate Meeting Notes Section */}
            <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
              <label className="input-field__label" htmlFor="req-notes">Meeting Notes</label>
              <textarea
                id="req-notes"
                className="dashboard-textarea"
                rows="2"
                placeholder="Record offline discussions, updates, next action items..."
                value={activeReq.meetingNotes}
                onChange={(e) => setActiveReq({ ...activeReq, meetingNotes: e.target.value })}
              />
            </div>
          </div>

          {/* SECTION 2: Dynamic Questionnaire & Scope Details (Unlocked when Section 1 is valid) */}
          {isSection1Valid() ? (
            <div className="flex flex-col gap-6" style={{ marginTop: 'var(--space-6)' }}>
              {/* Section 2 Progress Bar */}
              <div className="form-progress-bar" style={{ margin: 'var(--space-2) 0', padding: 'var(--space-3)', backgroundColor: 'var(--color-surface-hover)', borderRadius: 'var(--border-radius-md)' }}>
                <div className="flex justify-between text-xs font-semibold text-muted" style={{ marginBottom: '6px' }}>
                  <span>Section 2 Completion Progress</span>
                  <span className="text-success">{calculateFormProgress()}%</span>
                </div>
                <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${calculateFormProgress()}%`, backgroundColor: 'var(--color-success)', transition: 'width 0.3s ease' }} />
                </div>
              </div>

              {/* Requirement Scope Description (Common for both) */}
              <div className="border-box-reference">
                <span className="text-sm font-semibold color-primary-light">Scope Details</span>
                <div className="form-group" style={{ marginTop: 'var(--space-2)' }}>
                  <label className="input-field__label" htmlFor="req-desc">Requirement Description / Scope Details *</label>
                  <textarea
                    id="req-desc"
                    className="dashboard-textarea"
                    rows="3"
                    placeholder="Provide a general overview of the client scope discussion..."
                    value={activeReq.description}
                    onChange={(e) => setActiveReq({ ...activeReq, description: e.target.value })}
                    required
                  />
                </div>
              </div>

              {activeReq.templateId === 'other' ? (
                <>
                  {/* Default Specifications (Only for Other Requirement) */}
                  <div className="border-box-reference">
                    <span className="text-sm font-semibold color-primary-light">Scope Specifications (Default)</span>
                    <div className="form-grid-3" style={{ marginTop: 'var(--space-2)' }}>
                      <Input
                        id="req-material"
                        label="Materials / Specifications"
                        placeholder="e.g. Aluminum, Cat6"
                        value={activeReq.material}
                        onChange={(e) => setActiveReq({ ...activeReq, material: e.target.value })}
                      />
                      <Input
                        id="req-qty"
                        label="Quantity Required"
                        placeholder="e.g. 50 units"
                        value={activeReq.quantity}
                        onChange={(e) => setActiveReq({ ...activeReq, quantity: e.target.value })}
                      />
                      <Input
                        id="req-deliv-date"
                        type="date"
                        label="Required Delivery Date"
                        value={activeReq.requiredDeliveryDate}
                        onChange={(e) => setActiveReq({ ...activeReq, requiredDeliveryDate: e.target.value })}
                      />
                    </div>

                    <div className="form-grid-3" style={{ marginTop: 'var(--space-2)' }}>
                      <div className="form-group">
                        <label className="input-field__label" htmlFor="req-prior">Priority Level</label>
                        <select
                          id="req-prior"
                          className="dashboard-select"
                          value={activeReq.priority}
                          onChange={(e) => setActiveReq({ ...activeReq, priority: e.target.value })}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                      <Input
                        id="req-budget-val"
                        label="Expected Budget"
                        placeholder="e.g. $10,000"
                        value={activeReq.expectedBudget}
                        onChange={(e) => setActiveReq({ ...activeReq, expectedBudget: e.target.value })}
                      />
                      <div className="form-group">
                        <label className="input-field__label" htmlFor="req-stat-select">Requirement Status</label>
                        <select
                          id="req-stat-select"
                          className="dashboard-select"
                          value={activeReq.status}
                          onChange={(e) => setActiveReq({ ...activeReq, status: e.target.value })}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Under Discussion">Under Discussion</option>
                          <option value="Ready for Manufacturer">Ready for Manufacturer</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Standard Attachments (Only for Other Requirement) */}
                  <div className="border-box-reference" style={{ borderStyle: 'solid' }}>
                    <span className="text-sm font-semibold color-primary-light">Scope Attachments</span>
                    <div className="form-grid-3" style={{ marginTop: 'var(--space-2)' }}>
                      <div className="form-group">
                        <FileUpload
                          label="Images File"
                          onUploadSuccess={(url) => handleAttachmentFieldChange('images', url)}
                        />
                        <div className="uploaded-files flex flex-col gap-1 text-xs" style={{ marginTop: '4px' }}>
                          {renderAttachmentLinks(activeReq.attachments.images)}
                        </div>
                      </div>
                      <div className="form-group">
                        <FileUpload
                          label="Drawings (PDF/IMG)"
                          onUploadSuccess={(url) => handleAttachmentFieldChange('drawings', url)}
                        />
                        <div className="uploaded-files flex flex-col gap-1 text-xs" style={{ marginTop: '4px' }}>
                          {renderAttachmentLinks(activeReq.attachments.drawings)}
                        </div>
                      </div>
                      <div className="form-group">
                        <FileUpload
                          label="Proposal PDF"
                          onUploadSuccess={(url) => handleAttachmentFieldChange('pdf', url)}
                        />
                        <div className="uploaded-files flex flex-col gap-1 text-xs" style={{ marginTop: '4px' }}>
                          {renderAttachmentLinks(activeReq.attachments.pdf)}
                        </div>
                      </div>
                      <div className="form-group">
                        <FileUpload
                          label="CAD Files"
                          onUploadSuccess={(url) => handleAttachmentFieldChange('cadFiles', url)}
                        />
                        <div className="uploaded-files flex flex-col gap-1 text-xs" style={{ marginTop: '4px' }}>
                          {renderAttachmentLinks(activeReq.attachments.cadFiles)}
                        </div>
                      </div>
                      <div className="form-group">
                        <FileUpload
                          label="Videos"
                          onUploadSuccess={(url) => handleAttachmentFieldChange('videos', url)}
                        />
                        <div className="uploaded-files flex flex-col gap-1 text-xs" style={{ marginTop: '4px' }}>
                          {renderAttachmentLinks(activeReq.attachments.videos)}
                        </div>
                      </div>
                      <div className="form-group">
                        <FileUpload
                          label="Voice Notes"
                          onUploadSuccess={(url) => handleAttachmentFieldChange('voiceNotes', url)}
                        />
                        <div className="uploaded-files flex flex-col gap-1 text-xs" style={{ marginTop: '4px' }}>
                          {renderAttachmentLinks(activeReq.attachments.voiceNotes)}
                        </div>
                      </div>
                    </div>

                    {/* File Naming options */}
                    <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
                      <label className="input-field__label">File Naming Options</label>
                      <div className="flex gap-4 flex-wrap" style={{ marginTop: 'var(--space-1)' }}>
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="radio"
                            name="file-option"
                            checked={activeReq.fileOption === 'Keep Original Filename'}
                            onChange={() => setActiveReq({ ...activeReq, fileOption: 'Keep Original Filename' })}
                          />
                          Keep Original Filename
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="radio"
                            name="file-option"
                            checked={activeReq.fileOption === 'Rename File'}
                            onChange={() => setActiveReq({ ...activeReq, fileOption: 'Rename File' })}
                          />
                          Rename File
                        </label>
                        <label className="flex items-center gap-2 text-sm font-medium">
                          <input
                            type="radio"
                            name="file-option"
                            checked={activeReq.fileOption === 'Auto Rename'}
                            onChange={() => setActiveReq({ ...activeReq, fileOption: 'Auto Rename' })}
                          />
                          Auto Rename
                        </label>
                      </div>
                    </div>

                    {activeReq.fileOption === 'Rename File' && (
                      <Input
                        id="custom-file-prefix"
                        label="Custom File Name Prefix"
                        placeholder="e.g. acme_warehouse_scope"
                        value={activeReq.customFileName || ''}
                        onChange={(e) => setActiveReq({ ...activeReq, customFileName: e.target.value })}
                        required
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Dynamic Template Questionnaire */}
                  <div className="border-box-reference" style={{ borderStyle: 'solid' }}>
                    <span className="text-sm font-semibold color-primary-light">Section 2: Dynamic Questionnaire Details</span>
                    <div className="form-grid-2" style={{ marginTop: 'var(--space-2)' }}>
                      {renderDynamicFields()}
                    </div>
                  </div>

                  {/* Standard Controls (Priority, Status) for Templates */}
                  <div className="border-box-reference">
                    <span className="text-sm font-semibold color-primary-light">Controls & Priorities</span>
                    <div className="form-grid-2" style={{ marginTop: 'var(--space-2)' }}>
                      <div className="form-group">
                        <label className="input-field__label" htmlFor="req-prior-tpl">Priority Level</label>
                        <select
                          id="req-prior-tpl"
                          className="dashboard-select"
                          value={activeReq.priority}
                          onChange={(e) => setActiveReq({ ...activeReq, priority: e.target.value })}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="input-field__label" htmlFor="req-stat-tpl">Requirement Status</label>
                        <select
                          id="req-stat-tpl"
                          className="dashboard-select"
                          value={activeReq.status}
                          onChange={(e) => setActiveReq({ ...activeReq, status: e.target.value })}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Under Discussion">Under Discussion</option>
                          <option value="Ready for Manufacturer">Ready for Manufacturer</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center text-xs font-semibold" style={{ marginTop: 'var(--space-4)', padding: 'var(--space-6)', backgroundColor: 'var(--color-surface-hover)', border: '1px dashed var(--color-border)', borderRadius: 'var(--border-radius-md)', color: 'var(--color-text-muted)' }}>
              Complete Section 1 (Meeting Information) to unlock Requirement Scope & Dynamic Questionnaire details.
            </div>
          )}
        </form>
      </Modal>

      {/* --- DETAIL VIEW MODAL --- */}
      <Modal
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        title={`Requirement Detail Profile: ${viewReq?.id}`}
        size="lg"
      >
        {viewReq && (
          <div className="company-view-details">
            <div className="company-view-details__header flex justify-between items-center">
              <div>
                <h2>{viewReq.title}</h2>
                <span className="text-sm text-muted">Client: <strong>{viewReq.companyName}</strong></span>
              </div>
              <Badge variant={viewReq.status === 'Ready for Manufacturer' ? 'success' : viewReq.status === 'Under Discussion' ? 'info' : 'warning'}>
                {viewReq.status}
              </Badge>
            </div>

            <div className="dropdown-divider" />

            <div className="company-view-details__grid">
              <div className="company-view-details__sec">
                <h3>Specifications & Budget</h3>
                <p><strong>Material Scope:</strong> {viewReq.material || 'N/A'}</p>
                <p><strong>Quantity:</strong> {viewReq.quantity || 'N/A'}</p>
                <p><strong>Expected Budget:</strong> <span className="font-semibold text-success">{viewReq.expectedBudget || 'Not Specified'}</span></p>
                <p><strong>Required Delivery Date:</strong> {viewReq.requiredDeliveryDate || 'N/A'}</p>
                <p><strong>Priority Level:</strong> <Badge variant={viewReq.priority === 'Critical' || viewReq.priority === 'High' ? 'danger' : 'warning'}>{viewReq.priority}</Badge></p>
              </div>

              <div className="company-view-details__sec">
                <h3>Meeting Parameters</h3>
                <p><strong>Meeting Mode:</strong> {viewReq.meetingType}</p>
                <p><strong>Scheduled:</strong> {viewReq.meetingDate} at {viewReq.meetingTime}</p>
                {viewReq.meetingType === 'Online' ? (
                  <p><strong>Meeting Link:</strong> <a href={viewReq.meetingLink} target="_blank" rel="noreferrer" className="text-success">{viewReq.meetingLink || 'N/A'}</a></p>
                ) : (
                  <p><strong>Location:</strong> {viewReq.meetingLocation || 'N/A'}</p>
                )}
                <p><strong>Attendees Present:</strong> {viewReq.employeesPresent || 'N/A'}</p>
                <p><strong>Customer Reps Present:</strong> {viewReq.customerReps || 'N/A'}</p>
              </div>
            </div>

            <div className="company-view-details__sec" style={{ marginTop: 'var(--space-4)' }}>
              <h3>Requirement Scope Description</h3>
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{viewReq.description}</p>
            </div>

            <div className="company-view-details__sec" style={{ marginTop: 'var(--space-4)' }}>
              <h3>Meeting Notes (Stored Separately)</h3>
              <p className="text-sm text-muted" style={{ whiteSpace: 'pre-wrap', backgroundColor: 'var(--color-surface-hover)', padding: 'var(--space-4)', borderRadius: 'var(--border-radius-sm)' }}>
                {viewReq.meetingNotes || 'No notes added to this meeting record.'}
              </p>
            </div>

            {/* Custom Template Questionnaire responses */}
            {viewReq.templateId && viewReq.dynamicResponses && Object.keys(viewReq.dynamicResponses).length > 0 && (
              <div className="company-view-details__sec" style={{ marginTop: 'var(--space-4)' }}>
                <h3>Custom Questionnaire Details</h3>
                <div className="form-grid-2" style={{ backgroundColor: 'var(--color-surface-hover)', padding: 'var(--space-4)', borderRadius: 'var(--border-radius-sm)', gap: 'var(--space-4)' }}>
                  {Object.entries(viewReq.dynamicResponses).map(([key, val]) => {
                    const isLink = typeof val === 'string' && val.startsWith('http');
                    const isLinkArray = Array.isArray(val) && val.length > 0 && val.every(item => typeof item === 'string' && item.startsWith('http'));

                    return (
                      <div className="form-group" key={key} style={{ margin: 0 }}>
                        <span className="text-xs text-muted font-semibold block">{key}</span>
                        <div style={{ marginTop: '2px' }}>
                          {isLink || isLinkArray ? (
                            <div className="flex gap-2 flex-wrap">
                              {renderAttachmentLinks(val)}
                            </div>
                          ) : (
                            <span className="text-sm font-semibold">{val === true ? 'Yes' : val === false ? 'No' : (val.toString() || 'N/A')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Attachments rendering */}
            {(viewReq.attachments?.images ||
              viewReq.attachments?.drawings ||
              viewReq.attachments?.pdf ||
              viewReq.attachments?.cadFiles ||
              viewReq.attachments?.videos ||
              viewReq.attachments?.voiceNotes) && (
              <div className="company-view-details__sec" style={{ marginTop: 'var(--space-4)' }}>
                <h3>Scope Attachments & Documentation ({viewReq.fileOption})</h3>
                <div className="flex gap-4 flex-wrap" style={{ marginTop: 'var(--space-2)' }}>
                  {viewReq.attachments.images && (
                    <div className="attachment-badge flex items-center gap-2 flex-wrap">
                      <span className="material-icons">image</span>
                      <div className="flex gap-2 flex-wrap">
                        {renderAttachmentLinks(viewReq.attachments.images)}
                      </div>
                    </div>
                  )}
                  {viewReq.attachments.drawings && (
                    <div className="attachment-badge flex items-center gap-2 flex-wrap">
                      <span className="material-icons">architecture</span>
                      <div className="flex gap-2 flex-wrap">
                        {renderAttachmentLinks(viewReq.attachments.drawings)}
                      </div>
                    </div>
                  )}
                  {viewReq.attachments.pdf && (
                    <div className="attachment-badge flex items-center gap-2 flex-wrap">
                      <span className="material-icons">picture_as_pdf</span>
                      <div className="flex gap-2 flex-wrap">
                        {renderAttachmentLinks(viewReq.attachments.pdf)}
                      </div>
                    </div>
                  )}
                  {viewReq.attachments.cadFiles && (
                    <div className="attachment-badge flex items-center gap-2 flex-wrap">
                      <span className="material-icons">settings_input_composite</span>
                      <div className="flex gap-2 flex-wrap">
                        {renderAttachmentLinks(viewReq.attachments.cadFiles)}
                      </div>
                    </div>
                  )}
                  {viewReq.attachments.videos && (
                    <div className="attachment-badge flex items-center gap-2 flex-wrap">
                      <span className="material-icons">videocam</span>
                      <div className="flex gap-2 flex-wrap">
                        {renderAttachmentLinks(viewReq.attachments.videos)}
                      </div>
                    </div>
                  )}
                  {viewReq.attachments.voiceNotes && (
                    <div className="attachment-badge flex items-center gap-2 flex-wrap">
                      <span className="material-icons">keyboard_voice</span>
                      <div className="flex gap-2 flex-wrap">
                        {renderAttachmentLinks(viewReq.attachments.voiceNotes)}
                      </div>
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

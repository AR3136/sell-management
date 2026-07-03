import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Table from '../../components/common/Table';
import './RequirementTypesPage.css';

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'number', label: 'Number Input' },
  { value: 'paragraph', label: 'Paragraph Text' },
  { value: 'dropdown', label: 'Dropdown Select' },
  { value: 'checkbox', label: 'Checkbox Option' },
  { value: 'radio', label: 'Radio Buttons' },
  { value: 'date', label: 'Date Picker' },
  { value: 'time', label: 'Time Picker' },
  { value: 'file', label: 'Single File Upload' },
  { value: 'image', label: 'Image Upload' },
  { value: 'drawing', label: 'Drawing Upload' },
  { value: 'pdf', label: 'PDF Document Upload' },
  { value: 'cad', label: 'CAD File Upload' },
  { value: 'excel', label: 'Excel/Spreadsheet Upload' },
  { value: 'video', label: 'Video Upload' },
  { value: 'voice', label: 'Voice Note Record/Upload' },
  { value: 'multiple_files', label: 'Multiple Files Upload' },
];

export default function RequirementTypesPage() {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  
  // Template form state
  const [activeTemplate, setActiveTemplate] = useState({
    id: '',
    name: '',
    description: '',
    category: 'General',
    status: 'Active',
    fields: []
  });

  // Builder current field state
  const [editingField, setEditingField] = useState(null);
  const [fieldForm, setFieldForm] = useState({
    name: '',
    type: 'text',
    required: false,
    placeholder: '',
    defaultValue: '',
    helpText: '',
    dropdownValues: '' // comma-separated
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('requirement_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      setTemplates(data || []);
    }
    setIsLoading(false);
  };

  const handleCreateOpen = () => {
    setModalMode('create');
    setActiveTemplate({
      id: '',
      name: '',
      description: '',
      category: 'General',
      status: 'Active',
      fields: []
    });
    setEditingField(null);
    setModalOpen(true);
  };

  const handleEditOpen = (tpl) => {
    setModalMode('edit');
    setActiveTemplate({ ...tpl });
    setEditingField(null);
    setModalOpen(true);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete template "${name}"?`)) {
      const { error } = await supabase
        .from('requirement_templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting template:', error);
        alert('Failed to delete template: ' + error.message);
      } else {
        fetchTemplates();
      }
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!activeTemplate.name.trim()) {
      alert('Template Name is required.');
      return;
    }

    const payload = {
      name: activeTemplate.name,
      description: activeTemplate.description,
      category: activeTemplate.category,
      status: activeTemplate.status,
      fields: activeTemplate.fields
    };

    let result;
    if (modalMode === 'edit') {
      result = await supabase
        .from('requirement_templates')
        .update(payload)
        .eq('id', activeTemplate.id);
    } else {
      result = await supabase
        .from('requirement_templates')
        .insert([payload]);
    }

    if (result.error) {
      console.error('Error saving template:', result.error);
      alert('Failed to save template: ' + result.error.message);
    } else {
      fetchTemplates();
      setModalOpen(false);
    }
  };

  // CSV file parser (Method 1)
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        alert('CSV file is empty or missing data rows.');
        return;
      }

      // Detect headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      
      const parsedFields = lines.slice(1).map((line, idx) => {
        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        const row = {};
        headers.forEach((header, colIdx) => {
          row[header] = cols[colIdx] || '';
        });

        // Question mapping
        const qName = row.question || row.name || row.field || `Question ${idx + 1}`;
        const rawType = (row.type || row.field_type || 'text').toLowerCase();
        
        // Map raw CSV field types to supported fields
        let type = 'text';
        if (rawType.includes('number')) type = 'number';
        else if (rawType.includes('paragraph') || rawType.includes('textarea')) type = 'paragraph';
        else if (rawType.includes('dropdown') || rawType.includes('select')) type = 'dropdown';
        else if (rawType.includes('checkbox')) type = 'checkbox';
        else if (rawType.includes('radio')) type = 'radio';
        else if (rawType.includes('date')) type = 'date';
        else if (rawType.includes('time')) type = 'time';
        else if (rawType.includes('multiple_files') || rawType.includes('files')) type = 'multiple_files';
        else if (rawType.includes('file')) type = 'file';
        else if (rawType.includes('image')) type = 'image';
        else if (rawType.includes('drawing')) type = 'drawing';
        else if (rawType.includes('pdf')) type = 'pdf';

        const isRequired = row.required === 'true' || row.required === '1' || row.required === 'yes' || row.required === 'y';

        return {
          id: `csv-${Date.now()}-${idx}`,
          name: qName,
          type: type,
          required: isRequired,
          placeholder: row.placeholder || '',
          defaultValue: row.default || row.default_value || '',
          helpText: row.help || row.help_text || '',
          dropdownValues: row.options || row.dropdown_values || '',
          order: idx + 1
        };
      });

      setActiveTemplate(prev => ({
        ...prev,
        fields: [...prev.fields, ...parsedFields]
      }));

      alert(`Successfully imported ${parsedFields.length} fields from CSV!`);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Add field to template (Method 2)
  const handleAddField = () => {
    if (!fieldForm.name.trim()) {
      alert('Question label is required.');
      return;
    }

    const newField = {
      id: editingField ? editingField.id : `field-${Date.now()}`,
      name: fieldForm.name,
      type: fieldForm.type,
      required: fieldForm.required,
      placeholder: fieldForm.placeholder,
      defaultValue: fieldForm.defaultValue,
      helpText: fieldForm.helpText,
      dropdownValues: fieldForm.dropdownValues,
      order: activeTemplate.fields.length + 1
    };

    if (editingField) {
      // Edit
      setActiveTemplate(prev => ({
        ...prev,
        fields: prev.fields.map(f => f.id === editingField.id ? newField : f)
      }));
      setEditingField(null);
    } else {
      // Create
      setActiveTemplate(prev => ({
        ...prev,
        fields: [...prev.fields, newField]
      }));
    }

    // Reset field builder
    setFieldForm({
      name: '',
      type: 'text',
      required: false,
      placeholder: '',
      defaultValue: '',
      helpText: '',
      dropdownValues: ''
    });
  };

  const handleEditField = (field) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder || '',
      defaultValue: field.defaultValue || '',
      helpText: field.helpText || '',
      dropdownValues: field.dropdownValues || ''
    });
  };

  const handleRemoveField = (fieldId) => {
    setActiveTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== fieldId)
    }));
  };

  // Search filter
  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchVal.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchVal.toLowerCase()))
  );

  return (
    <div className="module-page">
      <div className="module-page__header flex justify-between items-center">
        <div>
          <h1 className="module-page__title">Requirement Types (Templates)</h1>
          <p className="module-page__subtitle">Create reusable template structures to define fields, dropdowns, and file slots for order requirements.</p>
        </div>
        <Button variant="primary" icon="add" onClick={handleCreateOpen}>
          New Template
        </Button>
      </div>

      {/* Control panel */}
      <Card padding="md" style={{ marginBottom: 'var(--space-4)' }}>
        <Input
          id="search-templates"
          placeholder="Search templates by name or description..."
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          icon="search"
        />
      </Card>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center" style={{ height: '200px' }}>
          <span className="material-icons spinner color-accent" style={{ fontSize: '36px' }}>sync</span>
        </div>
      ) : (
        <Card padding="none">
          <Table
            headers={['Template Name', 'Category', 'Description', 'Fields Count', 'Status', 'Actions']}
            rows={filteredTemplates.map((t) => [
              <strong key="name">{t.name}</strong>,
              <span key="cat" className="text-muted text-xs font-semibold">{t.category}</span>,
              <span key="desc" className="text-sm text-muted line-clamp-1">{t.description || 'No description provided.'}</span>,
              <Badge key="cnt" variant="info">{(t.fields || []).length} Fields</Badge>,
              <Badge key="status" variant={t.status === 'Active' ? 'success' : 'neutral'}>{t.status}</Badge>,
              <div key="actions" className="flex gap-2">
                <Button variant="outline" size="sm" icon="edit" onClick={() => handleEditOpen(t)}>Edit</Button>
                <Button variant="danger" size="sm" icon="delete" onClick={() => handleDelete(t.id, t.name)}>Delete</Button>
              </div>
            ])}
          />
        </Card>
      )}

      {/* Template Creator/Editor Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalMode === 'create' ? 'Create Requirement Template' : 'Edit Template Structure'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="template-form">Save Template</Button>
          </>
        }
      >
        <div className="builder-layout">
          {/* Main Template details & Field list */}
          <form id="template-form" onSubmit={handleSaveTemplate} className="flex flex-col gap-4">
            <div className="form-grid-2">
              <Input
                id="tpl-name"
                label="Template/Requirement Type Name *"
                value={activeTemplate.name}
                onChange={(e) => setActiveTemplate({ ...activeTemplate, name: e.target.value })}
                required
              />
              <div className="form-group">
                <label className="input-field__label" htmlFor="tpl-cat">Category</label>
                <select
                  id="tpl-cat"
                  className="dashboard-select"
                  value={activeTemplate.category}
                  onChange={(e) => setActiveTemplate({ ...activeTemplate, category: e.target.value })}
                >
                  <option value="General">General</option>
                  <option value="Hardware">Hardware Specs</option>
                  <option value="Software">Software Integration</option>
                  <option value="Mechanical">Mechanical CAD</option>
                  <option value="Compliance">Regulatory/Compliance</option>
                </select>
              </div>
            </div>

            <Input
              id="tpl-desc"
              label="Description"
              value={activeTemplate.description}
              onChange={(e) => setActiveTemplate({ ...activeTemplate, description: e.target.value })}
            />

            <div className="form-group">
              <label className="input-field__label">Status</label>
              <div className="flex gap-4" style={{ marginTop: '4px' }}>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="tpl-status"
                    checked={activeTemplate.status === 'Active'}
                    onChange={() => setActiveTemplate({ ...activeTemplate, status: 'Active' })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name="tpl-status"
                    checked={activeTemplate.status === 'Inactive'}
                    onChange={() => setActiveTemplate({ ...activeTemplate, status: 'Inactive' })}
                  />
                  Inactive
                </label>
              </div>
            </div>

            <hr style={{ borderColor: 'var(--color-border)' }} />

            {/* Method 1: CSV Upload */}
            <div className="form-group">
              <label className="input-field__label">Method 1: Import Fields from Excel/CSV</label>
              <div className="csv-upload-zone" onClick={() => document.getElementById('csv-file-picker').click()}>
                <span className="material-icons color-accent" style={{ fontSize: '32px' }}>upload_file</span>
                <p className="text-sm font-semibold" style={{ marginTop: '4px' }}>Click to Upload Excel/CSV Template</p>
                <p className="text-xs text-muted">Columns recognized: Question, Field Type, Required, Options, Help Text</p>
                <input
                  type="file"
                  id="csv-file-picker"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleCSVUpload}
                />
              </div>
            </div>

            {/* List of fields */}
            <div>
              <label className="input-field__label">Configured Form Fields ({activeTemplate.fields.length})</label>
              <div className="builder-fields-list">
                {activeTemplate.fields.length === 0 ? (
                  <p className="text-xs text-muted text-center" style={{ padding: 'var(--space-4)' }}>No custom questions configured. Use the builder or CSV importer.</p>
                ) : (
                  activeTemplate.fields.map((f, i) => (
                    <div className="builder-field-item" key={f.id}>
                      <div className="builder-field-item__info">
                        <span className="text-sm font-bold flex items-center gap-2">
                          {f.name}
                          {f.required && <Badge variant="danger">Required</Badge>}
                        </span>
                        <span className="text-xs text-muted">
                          Type: <strong>{FIELD_TYPES.find(ft => ft.value === f.type)?.label || f.type}</strong>
                          {f.dropdownValues && ` (Options: ${f.dropdownValues})`}
                        </span>
                      </div>
                      <div className="builder-field-item__actions">
                        <Button variant="ghost" size="sm" icon="edit" onClick={() => handleEditField(f)} title="Edit field parameters" />
                        <Button variant="danger" size="sm" icon="delete" onClick={() => handleRemoveField(f.id)} title="Remove field" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </form>

          {/* Right sidebar: Method 2 (Manual field editor builder) */}
          <Card padding="md" className="field-editor-panel flex flex-col gap-4">
            <h4 className="font-bold color-primary">Method 2: Manual Form Field Builder</h4>
            
            <Input
              id="field-name"
              label="Question/Field Label *"
              placeholder="e.g. Dimensions Requirement"
              value={fieldForm.name}
              onChange={(e) => setFieldForm({ ...fieldForm, name: e.target.value })}
            />

            <div className="form-group">
              <label className="input-field__label" htmlFor="field-type-select">Field Input Type</label>
              <select
                id="field-type-select"
                className="dashboard-select"
                value={fieldForm.type}
                onChange={(e) => setFieldForm({ ...fieldForm, type: e.target.value })}
              >
                {FIELD_TYPES.map(ft => (
                  <option key={ft.value} value={ft.value}>{ft.label}</option>
                ))}
              </select>
            </div>

            {/* Dropdown values if relevant */}
            {(fieldForm.type === 'dropdown' || fieldForm.type === 'radio' || fieldForm.type === 'checkbox') && (
              <div className="form-group">
                <label className="input-field__label">Dropdown Selection Options (Comma separated)</label>
                <textarea
                  className="options-list-input"
                  rows="2"
                  placeholder="e.g. Option A, Option B, Option C"
                  value={fieldForm.dropdownValues}
                  onChange={(e) => setFieldForm({ ...fieldForm, dropdownValues: e.target.value })}
                />
              </div>
            )}

            <Input
              id="field-placeholder"
              label="Input Placeholder Text"
              placeholder="e.g. Enter length in mm"
              value={fieldForm.placeholder}
              onChange={(e) => setFieldForm({ ...fieldForm, placeholder: e.target.value })}
            />

            <Input
              id="field-help"
              label="Help Hint Text"
              placeholder="e.g. Check details drawing catalog"
              value={fieldForm.helpText}
              onChange={(e) => setFieldForm({ ...fieldForm, helpText: e.target.value })}
            />

            <div className="form-group">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={fieldForm.required}
                  onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })}
                />
                Required Question
              </label>
            </div>

            <Button variant="secondary" icon={editingField ? 'save' : 'add'} onClick={handleAddField} style={{ width: '100%' }}>
              {editingField ? 'Update Field' : 'Add to Template'}
            </Button>
          </Card>
        </div>
      </Modal>
    </div>
  );
}

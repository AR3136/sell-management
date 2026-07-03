import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Avatar from '../../components/common/Avatar';
import '../approached/ModulePages.css';
import './EmployeeManagementPage.css';

export default function EmployeeManagementPage() {
  // -- Available Modules & Permission Levels --
  const modulesList = [
    'Dashboard',
    'Approached',
    'Communication',
    'Requirements',
    'Order Processing',
    'Payment Cycle',
    'Employee Management',
    'Settings',
  ];

  const permissionLevels = ['No Access', 'View', 'Add', 'Edit', 'Delete', 'Full Control'];

  // -- Default Permissions structure --
  const defaultPermissions = () => {
    const perm = {};
    modulesList.forEach((m) => {
      perm[m] = 'View'; // Default level
    });
    return perm;
  };

  // -- Defined Roles / Templates list --
  const [roles, setRoles] = useState([
    {
      name: 'Administrator',
      permissions: {
        Dashboard: 'Full Control',
        Approached: 'Full Control',
        Communication: 'Full Control',
        Requirements: 'Full Control',
        'Order Processing': 'Full Control',
        'Payment Cycle': 'Full Control',
        'Employee Management': 'Full Control',
        Settings: 'Full Control',
      },
    },
    {
      name: 'Sales Manager',
      permissions: {
        Dashboard: 'View',
        Approached: 'Full Control',
        Communication: 'Full Control',
        Requirements: 'Full Control',
        'Order Processing': 'View',
        'Payment Cycle': 'View',
        'Employee Management': 'No Access',
        Settings: 'No Access',
      },
    },
  ]);

  // -- Employee Database State --
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employees:', error);
    } else {
      const mapped = data.map(p => ({
        id: p.id,
        name: p.name,
        department: p.department || 'Unknown',
        designation: p.designation || 'Employee', // if designation added later
        phone: p.phone || '',
        email: p.email,
        joiningDate: p.created_at ? p.created_at.split('T')[0] : '',
        status: p.is_active ? 'Active' : 'Inactive',
        username: p.email ? p.email.split('@')[0] : '',
        role: p.role || 'Employee',
        permissions: p.permissions || defaultPermissions(), // if permissions added later
      }));
      setEmployees(mapped);
    }
    setIsLoading(false);
  };

  // -- Search, Filter & Tab States --
  const [activeTab, setActiveTab] = useState('employees'); // 'employees' | 'roles'
  const [searchVal, setSearchVal] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // -- Modal States --
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'

  // -- Active Forms States --
  const emptyEmployee = {
    id: '',
    name: '',
    department: 'Sales',
    designation: '',
    phone: '',
    email: '',
    joiningDate: '',
    status: 'Active',
    username: '',
    password: '',
    role: 'Sales Manager',
    permissions: defaultPermissions(),
  };

  const [activeEmp, setActiveEmp] = useState({ ...emptyEmployee });
  const [activeRole, setActiveRole] = useState({ name: '', permissions: defaultPermissions() });
  const [permEditorTarget, setPermEditorTarget] = useState(null); // Employee target for custom permission changes

  // -- Filters --
  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      const matchSearch =
        (e.name || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (e.email || '').toLowerCase().includes(searchVal.toLowerCase()) ||
        (e.id || '').toLowerCase().includes(searchVal.toLowerCase());
      const matchDept = deptFilter ? e.department === deptFilter : true;
      const matchStatus = statusFilter ? e.status === statusFilter : true;
      return matchSearch && matchDept && matchStatus;
    });
  }, [employees, searchVal, deptFilter, statusFilter]);

  // -- Handlers --
  const openCreateEmp = () => {
    setModalMode('create');
    setActiveEmp({
      ...emptyEmployee,
      id: `EMP-${Date.now().toString().slice(-3)}`,
      joiningDate: new Date().toISOString().split('T')[0],
    });
    setEmpModalOpen(true);
  };

  const openEditEmp = (emp, event) => {
    event.stopPropagation();
    setModalMode('edit');
    setActiveEmp({ ...emp, password: '' });
    setEmpModalOpen(true);
  };

  const handleDeleteEmp = async (id, event) => {
    event.stopPropagation();
    if (window.confirm(`Are you sure you want to delete employee record?`)) {
      alert('Note: Managing employees requires Supabase Admin API or Edge Functions. This will only update locally for now.');
      setEmployees(employees.filter((e) => e.id !== id));
    }
  };

  const handleEmpSaveSubmit = async (e) => {
    e.preventDefault();
    alert('Note: Managing employees requires Supabase Admin API to create Auth users. This will only update locally for now.');
    
    // Copy permissions from assigned template role if set
    const matchedRole = roles.find((r) => r.name === activeEmp.role);
    const assignedPermissions = matchedRole ? { ...matchedRole.permissions } : { ...activeEmp.permissions };

    const savedEmp = {
      ...activeEmp,
      permissions: assignedPermissions,
    };

    if (modalMode === 'edit') {
      setEmployees(employees.map((emp) => (emp.id === savedEmp.id ? savedEmp : emp)));
    } else {
      setEmployees([...employees, savedEmp]);
    }
    setEmpModalOpen(false);
  };

  // Role Template handlers
  const openCreateRole = () => {
    setActiveRole({ name: '', permissions: defaultPermissions() });
    setRoleModalOpen(true);
  };

  const handleRoleSaveSubmit = (e) => {
    e.preventDefault();
    if (!activeRole.name) return;
    setRoles([...roles, activeRole]);
    setRoleModalOpen(false);
  };

  const handlePermissionChange = (module, level) => {
    setActiveEmp({
      ...activeEmp,
      permissions: {
        ...activeEmp.permissions,
        [module]: level,
      },
    });
  };

  const handleRolePermissionChange = (module, level) => {
    setActiveRole({
      ...activeRole,
      permissions: {
        ...activeRole.permissions,
        [module]: level,
      },
    });
  };

  // Custom permission editor modal
  const openPermissionEditor = (emp, event) => {
    event.stopPropagation();
    setPermEditorTarget(emp);
    setPermissionModalOpen(true);
  };

  const saveCustomPermissions = () => {
    if (!permEditorTarget) return;
    setEmployees(employees.map((e) => (e.id === permEditorTarget.id ? permEditorTarget : e)));
    setPermissionModalOpen(false);
  };

  const updateTargetPermission = (module, level) => {
    setPermEditorTarget({
      ...permEditorTarget,
      permissions: {
        ...permEditorTarget.permissions,
        [module]: level,
      },
    });
  };

  return (
    <div className="module-page">
      {/* Header */}
      <div className="module-page__header flex justify-between items-center">
        <div>
          <h1 className="module-page__title">Employee & Authorization Management</h1>
          <p className="module-page__subtitle">Control team profiles, roles, and granular module permissions.</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'employees' ? (
            <Button variant="primary" icon="person_add" onClick={openCreateEmp}>
              Add Employee
            </Button>
          ) : (
            <Button variant="primary" icon="add" onClick={openCreateRole}>
              Create Role
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === 'employees' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('employees')}
        >
          Staff Directory
        </button>
        <button
          className={`tab-btn ${activeTab === 'roles' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('roles')}
        >
          Roles & Permissions Templates
        </button>
      </div>

      {activeTab === 'employees' && (
        <Card padding="md" className="module-page__table-card">
          {/* Filters */}
          <div className="module-page__filters flex items-center justify-between gap-4 flex-wrap">
            <div className="topnav__search">
              <span className="material-icons topnav__search-icon">search</span>
              <input
                type="text"
                className="topnav__search-input"
                placeholder="Search staff members..."
                value={searchVal}
                onChange={(e) => setSearchVal(e.target.value)}
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="dashboard-select"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  aria-label="Filter by Department"
                >
                  <option value="">All Departments</option>
                  <option value="Management">Management</option>
                  <option value="Sales">Sales</option>
                  <option value="Support">Support</option>
                  <option value="Production">Production</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="dashboard-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by Status"
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <Table
            headers={['Staff ID', 'Profile Details', 'Department', 'Designation', 'Contact', 'Auth Role', 'Status', 'Actions']}
            data={filteredEmployees}
            renderRow={(emp) => (
              <tr key={emp.id} style={{ cursor: 'pointer' }} onClick={(e) => openPermissionEditor(emp, e)}>
                <td><span className="font-semibold">{emp.id}</span></td>
                <td>
                  <div className="flex items-center gap-3">
                    <Avatar name={emp.name} size="sm" />
                    <div className="flex flex-col">
                      <span className="font-semibold">{emp.name}</span>
                      <span className="text-xs text-muted">User: @{emp.username}</span>
                    </div>
                  </div>
                </td>
                <td><Badge variant="primary">{emp.department}</Badge></td>
                <td>{emp.designation}</td>
                <td>
                  <div className="flex flex-col text-xs text-muted">
                    <span>{emp.phone}</span>
                    <span>{emp.email}</span>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <Badge variant="info">{emp.role}</Badge>
                    <span
                      className="material-icons text-muted"
                      style={{ fontSize: '16px', cursor: 'pointer' }}
                      onClick={(e) => openPermissionEditor(emp, e)}
                      title="Edit custom permission matrices"
                    >
                      security
                    </span>
                  </div>
                </td>
                <td>
                  <Badge variant={emp.status === 'Active' ? 'success' : 'danger'}>{emp.status}</Badge>
                </td>
                <td>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" icon="edit" onClick={(e) => openEditEmp(emp, e)} aria-label="Edit employee" />
                    <Button variant="ghost" size="sm" icon="delete" className="text-danger" onClick={(e) => handleDeleteEmp(emp.id, e)} aria-label="Delete employee" />
                  </div>
                </td>
              </tr>
            )}
          />
        </Card>
      )}

      {activeTab === 'roles' && (
        <div className="roles-grid">
          {roles.map((r, i) => (
            <Card padding="md" className="role-template-card" key={i}>
              <div className="role-template-card__header flex justify-between items-center">
                <span className="font-bold text-lg color-primary">{r.name} Template</span>
                <Badge variant="info">Global Role</Badge>
              </div>
              <div className="dropdown-divider" />
              <div className="role-template-card__permissions">
                {modulesList.map((m) => (
                  <div key={m} className="perm-row flex justify-between text-sm">
                    <span className="font-medium text-muted">{m}</span>
                    <Badge variant={r.permissions[m] === 'Full Control' ? 'success' : r.permissions[m] === 'No Access' ? 'danger' : 'info'}>
                      {r.permissions[m]}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* --- ADD / EDIT EMPLOYEE MODAL --- */}
      <Modal
        isOpen={empModalOpen}
        onClose={() => setEmpModalOpen(false)}
        title={modalMode === 'edit' ? `Edit Employee Record: ${activeEmp.id}` : 'Register Staff Account'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEmpModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="emp-form">Save Staff Member</Button>
          </>
        }
      >
        <form id="emp-form" onSubmit={handleEmpSaveSubmit} className="dashboard-modal-form">
          <h4 className="form-section-title">Personal Details</h4>
          <div className="form-grid-2">
            <Input
              id="emp-name"
              label="Full Name *"
              value={activeEmp.name}
              onChange={(e) => setActiveEmp({ ...activeEmp, name: e.target.value })}
              required
            />
            <div className="form-group">
              <label className="input-field__label" htmlFor="emp-dept-sel">Department</label>
              <select
                id="emp-dept-sel"
                className="dashboard-select"
                value={activeEmp.department}
                onChange={(e) => setActiveEmp({ ...activeEmp, department: e.target.value })}
              >
                <option value="Management">Management</option>
                <option value="Sales">Sales & Marketing</option>
                <option value="Support">Customer Support</option>
                <option value="Production">Operations & Production</option>
              </select>
            </div>
            <Input
              id="emp-desig"
              label="Official Designation *"
              value={activeEmp.designation}
              onChange={(e) => setActiveEmp({ ...activeEmp, designation: e.target.value })}
              required
            />
            <Input
              id="emp-phone"
              type="tel"
              label="Phone Number *"
              value={activeEmp.phone}
              onChange={(e) => setActiveEmp({ ...activeEmp, phone: e.target.value })}
              required
            />
            <Input
              id="emp-email"
              type="email"
              label="Work Email Address *"
              value={activeEmp.email}
              onChange={(e) => setActiveEmp({ ...activeEmp, email: e.target.value })}
              required
            />
            <Input
              id="emp-join"
              type="date"
              label="Joining Date"
              value={activeEmp.joiningDate}
              onChange={(e) => setActiveEmp({ ...activeEmp, joiningDate: e.target.value })}
            />
          </div>

          <div className="dropdown-divider" />

          <h4 className="form-section-title">Login Credentials & Base Role</h4>
          <div className="form-grid-3">
            <Input
              id="emp-user"
              label="Username *"
              value={activeEmp.username}
              onChange={(e) => setActiveEmp({ ...activeEmp, username: e.target.value })}
              required
            />
            <Input
              id="emp-pass"
              type="password"
              label={modalMode === 'edit' ? 'Password (Leave blank to keep)' : 'Password *'}
              value={activeEmp.password || ''}
              onChange={(e) => setActiveEmp({ ...activeEmp, password: e.target.value })}
              required={modalMode === 'create'}
            />
            <div className="form-group">
              <label className="input-field__label" htmlFor="emp-role-sel">Assign Role Template</label>
              <select
                id="emp-role-sel"
                className="dashboard-select"
                value={activeEmp.role}
                onChange={(e) => setActiveEmp({ ...activeEmp, role: e.target.value })}
              >
                {roles.map((r) => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid-2">
            <div className="form-group">
              <label className="input-field__label" htmlFor="emp-status-sel">Status</label>
              <select
                id="emp-status-sel"
                className="dashboard-select"
                value={activeEmp.status}
                onChange={(e) => setActiveEmp({ ...activeEmp, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>

      {/* --- CREATE ROLE TEMPLATE MODAL --- */}
      <Modal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title="Create Authorization Template Role"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRoleModalOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="role-form">Save Template</Button>
          </>
        }
      >
        <form id="role-form" onSubmit={handleRoleSaveSubmit} className="dashboard-modal-form">
          <Input
            id="role-name-input"
            label="Template Role Name *"
            placeholder="e.g. Sales Agent"
            value={activeRole.name}
            onChange={(e) => setActiveRole({ ...activeRole, name: e.target.value })}
            required
          />

          <div className="dropdown-divider" />
          <h4 className="form-section-title">Configure Authorization Access Matrix</h4>

          <div className="permission-matrix-box">
            {modulesList.map((m) => (
              <div key={m} className="matrix-row flex justify-between items-center gap-4">
                <span className="font-semibold text-primary flex-1">{m} Module</span>
                <div className="checkbox-permissions-group flex gap-2">
                  {permissionLevels.map((lvl) => (
                    <label key={lvl} className="matrix-checkbox-label">
                      <input
                        type="radio"
                        name={`perm-${m}`}
                        value={lvl}
                        checked={activeRole.permissions[m] === lvl}
                        onChange={() => handleRolePermissionChange(m, lvl)}
                      />
                      <span>{lvl}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </form>
      </Modal>

      {/* --- CUSTOM INDIVIDUAL PERMISSIONS EDITOR MODAL --- */}
      <Modal
        isOpen={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
        title={`Edit Granular Permissions: ${permEditorTarget?.name}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPermissionModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveCustomPermissions}>Apply Permissions</Button>
          </>
        }
      >
        {permEditorTarget && (
          <div className="permission-matrix-box">
            <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
              Note: Assigning custom levels below will override standard templates mapped from <strong>{permEditorTarget.role}</strong>.
            </p>
            {modulesList.map((m) => (
              <div key={m} className="matrix-row flex justify-between items-center gap-4">
                <span className="font-semibold text-primary flex-1">{m} Module</span>
                <div className="checkbox-permissions-group flex gap-2">
                  {permissionLevels.map((lvl) => (
                    <label key={lvl} className="matrix-checkbox-label">
                      <input
                        type="radio"
                        name={`custom-perm-${m}`}
                        value={lvl}
                        checked={permEditorTarget.permissions?.[m] === lvl}
                        onChange={() => updateTargetPermission(m, lvl)}
                      />
                      <span>{lvl}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

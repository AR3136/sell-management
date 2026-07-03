import SidebarItem from './SidebarItem';
import { useApp } from '../../context/AppContext';
import './Sidebar.css';

export default function Sidebar() {
  const { sidebarOpen, mobileSidebarOpen, closeMobileSidebar } = useApp();

  const menuItems = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/approached', icon: 'person_add', label: 'Approached' },
    { to: '/communication', icon: 'chat', label: 'Communication' },
    { to: '/requirements', icon: 'assignment', label: 'Requirements' },
    { to: '/requirement-types', icon: 'settings_suggest', label: 'Requirement Types' },
    { to: '/order-processing', icon: 'precision_manufacturing', label: 'Order Processing' },
    { to: '/payment-cycle', icon: 'payments', label: 'Payment Cycle' },
    { to: '/employee-management', icon: 'badge', label: 'Employee Management' },
    { to: '/settings', icon: 'settings', label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeMobileSidebar} />
      )}

      {/* Sidebar Container */}
      <aside
        className={`sidebar ${sidebarOpen ? 'sidebar--open' : 'sidebar--collapsed'} ${
          mobileSidebarOpen ? 'sidebar--mobile-open' : ''
        }`}
      >
        <div className="sidebar__brand">
          <span className="material-icons sidebar__brand-icon">business</span>
          {sidebarOpen && <span className="sidebar__brand-text">COP Operations</span>}
        </div>

        <nav className="sidebar__nav">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              collapsed={!sidebarOpen}
              onClick={closeMobileSidebar}
            />
          ))}
        </nav>

        <div className="sidebar__footer">
          {sidebarOpen ? (
            <span className="sidebar__footer-text">&copy; 2026 Company Inc.</span>
          ) : (
            <span className="material-icons sidebar__footer-icon">verified</span>
          )}
        </div>
      </aside>
    </>
  );
}

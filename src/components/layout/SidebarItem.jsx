import { NavLink } from 'react-router-dom';
import './Sidebar.css';

export default function SidebarItem({ to, icon, label, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `sidebar-item ${isActive ? 'sidebar-item--active' : ''} ${
          collapsed ? 'sidebar-item--collapsed' : ''
        }`
      }
      title={collapsed ? label : undefined}
    >
      <span className="material-icons sidebar-item__icon">{icon}</span>
      {!collapsed && <span className="sidebar-item__label">{label}</span>}
    </NavLink>
  );
}

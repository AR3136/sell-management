import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import Dropdown from '../common/Dropdown';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import './TopNavbar.css';

export default function TopNavbar() {
  const { user, logout } = useAuth();
  const {
    unreadCount,
    notifications,
    toggleSidebar,
    toggleMobileSidebar,
    markNotificationRead,
    markAllNotificationsRead,
  } = useApp();
  
  const [searchVal, setSearchVal] = useState('');
  
  // -- Dark Mode Toggle --
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const prefs = localStorage.getItem('cop_settings_prefs');
    if (prefs) {
      try {
        return JSON.parse(prefs).darkMode || false;
      } catch (e) {}
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
    // Update local storage
    const prefs = localStorage.getItem('cop_settings_prefs');
    let parsed = { darkMode: isDarkMode, denseTables: true, sidebarPlacement: 'left' };
    if (prefs) {
      try { parsed = { ...JSON.parse(prefs), darkMode: isDarkMode }; } catch(e) {}
    }
    localStorage.setItem('cop_settings_prefs', JSON.stringify(parsed));
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleSearchChange = (e) => {
    setSearchVal(e.target.value);
  };

  return (
    <header className="topnav">
      <div className="topnav__left">
        {/* Toggle Button for Desktop */}
        <button
          className="topnav__toggle-btn topnav__toggle-btn--desktop"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <span className="material-icons">menu</span>
        </button>

        {/* Toggle Button for Mobile */}
        <button
          className="topnav__toggle-btn topnav__toggle-btn--mobile"
          onClick={toggleMobileSidebar}
          aria-label="Toggle navigation menu"
        >
          <span className="material-icons">menu</span>
        </button>

        {/* Search Bar */}
        <div className="topnav__search">
          <span className="material-icons topnav__search-icon">search</span>
          <input
            type="text"
            className="topnav__search-input"
            placeholder="Search leads, requirements, orders..."
            value={searchVal}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      <div className="topnav__right">
        {/* Dark Mode Toggle */}
        <button className="topnav__btn" onClick={toggleDarkMode} aria-label="Toggle Dark Mode">
          <span className="material-icons">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
        </button>

        {/* Notifications Dropdown */}
        <Dropdown
          align="right"
          trigger={
            <button className="topnav__btn" aria-label="View notifications">
              <span className="material-icons">notifications</span>
              {unreadCount > 0 && (
                <span className="topnav__badge">{unreadCount}</span>
              )}
            </button>
          }
        >
          <div className="notifications-dropdown">
            <div className="notifications-dropdown__header">
              <h4 className="notifications-dropdown__title">Notifications</h4>
              {unreadCount > 0 && (
                <button
                  className="notifications-dropdown__mark-all"
                  onClick={markAllNotificationsRead}
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="notifications-dropdown__list">
              {notifications.length === 0 ? (
                <div className="notifications-dropdown__empty">
                  No notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`notifications-dropdown__item ${
                      !notif.read ? 'notifications-dropdown__item--unread' : ''
                    }`}
                    onClick={() => markNotificationRead(notif.id)}
                  >
                    <div className="notifications-dropdown__text">{notif.message}</div>
                    <div className="notifications-dropdown__time">{notif.time}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Dropdown>

        {/* Profile Dropdown */}
        <Dropdown
          align="right"
          trigger={
            <button className="topnav__profile-trigger">
              <Avatar name={user?.name || 'User'} className="topnav__avatar" />
              <div className="topnav__profile-info">
                <span className="topnav__profile-name">{user?.name}</span>
                <span className="topnav__profile-role">{user?.role}</span>
              </div>
              <span className="material-icons topnav__profile-arrow">arrow_drop_down</span>
            </button>
          }
        >
          <div className="profile-dropdown-menu">
            <div className="profile-dropdown-menu__header">
              <div className="profile-dropdown-menu__name">{user?.name}</div>
              <div className="profile-dropdown-menu__email">{user?.email}</div>
              <div className="profile-dropdown-menu__dept">
                <Badge variant="primary" size="sm">{user?.department}</Badge>
              </div>
            </div>
            <div className="dropdown-divider" />
            <button className="profile-dropdown-menu__item" onClick={logout}>
              <span className="material-icons">logout</span>
              <span>Log Out</span>
            </button>
          </div>
        </Dropdown>
      </div>
    </header>
  );
}

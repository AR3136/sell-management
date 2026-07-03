import { Outlet } from 'react-router-dom';
import Sidebar from '../components/layout/Sidebar';
import TopNavbar from '../components/layout/TopNavbar';
import { useApp } from '../context/AppContext';
import './AppLayout.css';

export default function AppLayout() {
  const { sidebarOpen } = useApp();

  return (
    <div className="app-layout">
      {/* Left Sidebar */}
      <Sidebar />

      {/* Main Container */}
      <div className={`app-main-container ${sidebarOpen ? 'app-main-container--expanded' : 'app-main-container--collapsed'}`}>
        {/* Top Navbar */}
        <TopNavbar />

        {/* Dynamic Page Content */}
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

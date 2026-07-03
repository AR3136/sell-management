import { createContext, useContext, useReducer, useCallback } from 'react';

// ── Context ────────────────────────────────────────────────
const AppContext = createContext(null);

// ── Reducer ────────────────────────────────────────────────
const initialState = {
  sidebarOpen: true,       // desktop default: open
  mobileSidebarOpen: false,
  notifications: [
    { id: 'n1', message: 'Welcome to Company Operations Portal', read: false, time: 'Just now' },
    { id: 'n2', message: 'New module update available', read: false, time: '1h ago' },
    { id: 'n3', message: 'System maintenance scheduled for Sunday', read: true, time: '2h ago' },
  ],
};

function appReducer(state, action) {
  switch (action.type) {
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'TOGGLE_MOBILE_SIDEBAR':
      return { ...state, mobileSidebarOpen: !state.mobileSidebarOpen };
    case 'CLOSE_MOBILE_SIDEBAR':
      return { ...state, mobileSidebarOpen: false };
    case 'MARK_NOTIFICATION_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) =>
          n.id === action.payload ? { ...n, read: true } : n
        ),
      };
    case 'MARK_ALL_NOTIFICATIONS_READ':
      return {
        ...state,
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
      };
    default:
      return state;
  }
}

// ── Provider ───────────────────────────────────────────────
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const toggleSidebar = useCallback(() => dispatch({ type: 'TOGGLE_SIDEBAR' }), []);
  const toggleMobileSidebar = useCallback(() => dispatch({ type: 'TOGGLE_MOBILE_SIDEBAR' }), []);
  const closeMobileSidebar = useCallback(() => dispatch({ type: 'CLOSE_MOBILE_SIDEBAR' }), []);

  const markNotificationRead = useCallback(
    (id) => dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id }),
    []
  );
  const markAllNotificationsRead = useCallback(
    () => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' }),
    []
  );

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  return (
    <AppContext.Provider
      value={{
        sidebarOpen: state.sidebarOpen,
        mobileSidebarOpen: state.mobileSidebarOpen,
        notifications: state.notifications,
        unreadCount,
        toggleSidebar,
        toggleMobileSidebar,
        closeMobileSidebar,
        markNotificationRead,
        markAllNotificationsRead,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}

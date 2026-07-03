import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { login, logout, getSession } from '../services/authService';

// ── Context ────────────────────────────────────────────────
const AuthContext = createContext(null);

// ── Reducer ────────────────────────────────────────────────
const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,   // true on first load while we check localStorage
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false,
      };
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'LOGIN_FAILURE':
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

// ── Provider ───────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Rehydrate session on app load
  useEffect(() => {
    // Outer variable to hold the subscription reference for cleanup
    let authSubscription = null;

    const initSession = async () => {
      const session = await getSession();
      dispatch({ type: 'HYDRATE', payload: session?.user ?? null });
    };
    initSession();
    
    // Set up auth listener — store subscription OUTSIDE .then() so cleanup works
    import('../services/supabaseClient').then(({ supabase }) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_OUT') {
            dispatch({ type: 'LOGOUT' });
          } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            const currentSession = await getSession();
            if (currentSession?.user) {
               dispatch({ type: 'LOGIN_SUCCESS', payload: currentSession.user });
            }
          }
        }
      );
      authSubscription = subscription;
    });

    // This cleanup function is properly returned to React
    return () => {
      authSubscription?.unsubscribe();
    };
  }, []);

  const handleLogin = useCallback(async (email, password) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });
    const result = await login(email, password);
    if (result.success) {
      dispatch({ type: 'LOGIN_SUCCESS', payload: result.user });
    } else {
      dispatch({ type: 'LOGIN_FAILURE', payload: result.error });
    }
    return result;
  }, []);

  const handleLogout = useCallback(async () => {
    await logout();
    dispatch({ type: 'LOGOUT' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isLoading: state.isLoading,
        error: state.error,
        login: handleLogin,
        logout: handleLogout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

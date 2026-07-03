import { supabase } from './supabaseClient';

/**
 * authService.js
 * Supabase authentication service.
 */

// ── Auth Methods ───────────────────────────────────────────

/**
 * Login with email and password.
 * @returns {Promise<{ success: boolean, user?: object, error?: string }>}
 */
export async function login(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Get the profile data — guard against missing profile rows
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, department, avatar_url')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    const user = {
      ...data.user,
      ...(profile || {}), // safe spread — profile may be null if no row exists yet
    };

    return { success: true, user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Logout the current user.
 */
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Get the current session.
 * Returns null if no session.
 */
export async function getSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return null;
    }
    
    // Get the profile data — guard against missing or failed profile fetch
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, full_name, department, avatar_url')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.warn('Profile fetch failed in getSession — proceeding without profile:', profileError.message);
    }

    const user = {
      ...session.user,
      ...(profile || {}), // safe spread
    };
    
    return {
      user,
      token: session.access_token,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Request a password reset email.
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function requestPasswordReset(email) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    
    if (error) {
      return { success: false, error: error.message };
    }
    
    return {
      success: true,
      message: 'A password reset link has been sent to your email.',
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

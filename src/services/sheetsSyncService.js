import { supabase } from './supabaseClient';

const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';

/**
 * Consolidate all order-related data from Supabase and sync to Google Sheets
 */
export async function syncOrderToSheets(orderId) {
  try {
    // 1. Fetch Order details
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        *,
        companies (*)
      `)
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      throw new Error(`Order fetch failed: ${orderErr?.message || 'No record found'}`);
    }

    const companyId = order.company_id;

    // 2. Fetch linked Requirements
    const { data: requirement } = await supabase
      .from('requirements')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Fetch linked Communications
    const { data: communications } = await supabase
      .from('communications')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    // 4. Fetch Payments and Payment history
    const { data: payments } = await supabase
      .from('payments')
      .select(`
        *,
        payment_history (*)
      `)
      .eq('order_id', orderId);

    // Fetch timeline entries
    const { data: timelineData } = await supabase
      .from('order_timeline')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    // 5. Gather Settings for header branding
    let portalSettings = { companyName: 'Operations Portal', address: 'N/A', logoUrl: '' };
    try {
      const stored = localStorage.getItem('company_portal_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        portalSettings.companyName = parsed.companyName || portalSettings.companyName;
        portalSettings.address = parsed.address || portalSettings.address;
        portalSettings.logoUrl = parsed.logoUrl || portalSettings.logoUrl;
      }
    } catch (e) {
      console.warn('Could not read settings from localStorage', e);
    }

    // 6. Aggregate Attachments
    const attachments = {
      images: [],
      drawings: [],
      pdf: [],
      cadFiles: [],
      videos: [],
      voiceNotes: []
    };

    if (requirement?.attachments) {
      Object.keys(attachments).forEach(key => {
        const vals = requirement.attachments[key];
        if (Array.isArray(vals)) {
          attachments[key] = [...attachments[key], ...vals];
        } else if (vals) {
          attachments[key].push(vals);
        }
      });
    }

    // 7. Consolidate Payload for Google Sheets
    const payload = {
      spreadsheetId: order.spreadsheet_id || null,
      orderId: order.id.slice(-6).toUpperCase(), // User-friendly short ID
      companyName: order.companies?.name || 'Unknown',
      contactPerson: order.companies?.contact_person || 'N/A',
      reqTitle: requirement?.title || 'N/A',
      assignedEmployee: 'Agent', // Default
      priority: requirement?.priority || 'Medium',
      status: order.customer_decision || 'Active',
      orderDate: new Date(order.created_at).toLocaleDateString(),
      
      // Meetings
      meetingType: requirement?.meeting_type || 'N/A',
      meetingDate: requirement?.meeting_date || 'N/A',
      meetingTime: requirement?.meeting_time || 'N/A',
      meetingLocation: requirement?.meeting_location || 'N/A',
      meetingNotes: requirement?.meeting_notes || 'N/A',
      customerReps: requirement?.customer_reps || 'N/A',

      // Settings branding
      portalCompanyName: portalSettings.companyName,
      portalContact: portalSettings.address,
      logoUrl: portalSettings.logoUrl,

      // Payments list
      payments: (payments || []).map(p => ({
        "Invoice Number": p.invoice_number || 'N/A',
        "Due Date": p.due_date || 'N/A',
        "GST": p.gst || 'N/A',
        "Total Amount": p.total_amount ? `$${p.total_amount}` : '$0',
        "Advance Paid": p.advance_amount ? `$${p.advance_amount}` : '$0',
        "Status": p.status || 'Pending'
      })),

      // Communications
      communications: (communications || []).map(c => ({
        "Date": c.follow_up_date || new Date(c.created_at).toLocaleDateString(),
        "Time": c.time || 'N/A',
        "Interaction Mode": c.type || 'N/A',
        "Summary": c.summary || 'N/A',
        "Follow-up": c.follow_up_date || 'N/A',
        "Status": c.status || 'Active'
      })),

      attachments: attachments,
      timeline: timelineData || []
    };

    if (!GOOGLE_SCRIPT_URL) {
      console.warn('Sync warning: VITE_GOOGLE_SCRIPT_URL environment variable is missing.');
      // Save locally as pending and throw warning
      await queueFailedSync(orderId, 'syncOrder', payload, 'Missing VITE_GOOGLE_SCRIPT_URL');
      return { success: false, error: 'Google Script URL not configured' };
    }

    // 8. Dispatch POST request to GAS
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain' // Fix CORS preflight block on GAS Webapps
      },
      body: JSON.stringify({
        action: 'syncOrder',
        // Use full UUID as canonical ID; short display ID is in payload.orderId
        orderId: order.id,
        payload: payload
      })
    });

    // Always check HTTP status before attempting JSON parse
    if (!response.ok) {
      throw new Error(`Google Script HTTP error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.success) {
      // 9. Update Order tracking info on success
      await supabase
        .from('orders')
        .update({
          spreadsheet_id: result.spreadsheetId,
          spreadsheet_url: result.spreadsheetUrl,
          sync_status: 'Success',
          last_sync_time: new Date().toISOString(),
          sync_result: 'Sheets synchronized successfully.'
        })
        .eq('id', orderId);

      // Clean up from pending list if present
      await supabase.from('pending_syncs').delete().eq('order_id', orderId);

      return { success: true, url: result.spreadsheetUrl };
    } else {
      throw new Error(result.error || 'Unknown Apps Script error');
    }

  } catch (err) {
    console.error('Google Sheet Sync Error:', err);
    
    // Save failed attempt to pending queue
    await queueFailedSync(orderId, 'syncOrder', {}, err.message);

    // Update orders tracking info on failure
    await supabase
      .from('orders')
      .update({
        sync_status: 'Failed',
        last_sync_time: new Date().toISOString(),
        sync_result: `Failed: ${err.message}`
      })
      .eq('id', orderId);

    return { success: false, error: err.message };
  }
}

/**
 * Queue sync requests to Supabase pending_syncs table for automatic retries
 */
async function queueFailedSync(orderId, actionType, payload, errorMsg) {
  try {
    const { data: existing } = await supabase
      .from('pending_syncs')
      .select('id, retry_count')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('pending_syncs')
        .update({
          retry_count: existing.retry_count + 1,
          last_error: errorMsg,
          last_retry_at: new Date().toISOString() // use dedicated retry timestamp, not created_at
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('pending_syncs')
        .insert([{
          order_id: orderId,
          action_type: actionType,
          payload: payload,
          last_error: errorMsg
        }]);
    }
  } catch (e) {
    console.error('Error logging pending sync queue:', e);
  }
}

/**
 * Triggers sync retries for all pending items
 */
export async function retryPendingSyncs() {
  try {
    const { data: pendings } = await supabase
      .from('pending_syncs')
      .select('order_id, retry_count')
      .lt('retry_count', 5) // Cap at 5 retries to avoid infinite retry loops
      .limit(10);

    if (pendings && pendings.length > 0) {
      console.log(`Retrying ${pendings.length} pending Google Sheet syncs...`);
      for (const p of pendings) {
        await syncOrderToSheets(p.order_id);
      }
    }
  } catch (e) {
    console.error('Pending sync retry execution failed:', e);
  }
}

/**
 * Sync all sheets/orders corresponding to a given company
 */
export async function syncCompanyOrders(companyId) {
  try {
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id')
      .eq('company_id', companyId);

    if (ordersErr) {
      console.error('Failed to fetch orders for company sync:', ordersErr);
      return;
    }

    if (orders && orders.length > 0) {
      for (const o of orders) {
        await syncOrderToSheets(o.id);
      }
    }
  } catch (e) {
    console.error('Failed to sync company orders:', e);
  }
}

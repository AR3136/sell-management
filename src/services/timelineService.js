import { supabase } from './supabaseClient';

/**
 * Log an event to the timeline of a specific order.
 * Safe — never throws, always catches internally.
 */
export async function logTimelineEvent({ orderId, action, remarks, relatedFiles = [] }) {
  try {
    if (!orderId) return;

    // Get current user email/name — safely destructure
    let employeeName = 'Operations Portal';
    const { data: authData, error: authErr } = await supabase.auth.getUser();
    if (!authErr && authData?.user) {
      const u = authData.user;
      // Prefer full name from metadata, then email, then ID
      employeeName =
        u.user_metadata?.full_name ||
        u.email ||
        'Operations Portal';
    }

    const { error } = await supabase
      .from('order_timeline')
      .insert([{
        order_id: orderId,
        employee_name: employeeName,
        action,
        remarks: remarks || '',
        related_files: Array.isArray(relatedFiles)
          ? relatedFiles.filter(f => f) // remove nulls/empty
          : (relatedFiles ? [relatedFiles] : []),
      }]);

    if (error) {
      console.error('Error saving timeline event:', error);
    }
  } catch (err) {
    console.error('Failed to log timeline event:', err);
  }
}

/**
 * Log an event for all active orders of a company.
 * Filters to only orders that are still active (not completed).
 */
export async function logCompanyTimelineEvents(companyId, { action, remarks, relatedFiles = [] }) {
  try {
    if (!companyId) return;

    // Fetch active orders for this company — exclude fully completed ones
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('id')
      .eq('company_id', companyId)
      .lt('current_step_index', 6); // Not yet at "Completed" step

    if (ordersErr) {
      console.error('Failed to fetch orders for timeline logging:', ordersErr);
      return;
    }

    if (orders && orders.length > 0) {
      await Promise.all(
        orders.map(order =>
          logTimelineEvent({
            orderId: order.id,
            action,
            remarks,
            relatedFiles
          })
        )
      );
    }
  } catch (err) {
    console.error('Failed to log company timeline events:', err);
  }
}

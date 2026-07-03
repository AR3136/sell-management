import { supabase } from './supabaseClient';

/**
 * Uploads a file to Supabase Storage in the 'portal-attachments' bucket.
 * Returns the public URL of the uploaded file, or null on failure.
 * Does NOT throw — all errors are returned as null to allow graceful UI handling.
 */
export async function uploadFile(file) {
  if (!file) return null;

  try {
    // Generate a unique filename using crypto.randomUUID() for collision safety
    const rawExt = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const safeExt = rawExt || 'bin';
    const fileName = `${crypto.randomUUID()}_${Date.now()}.${safeExt}`;

    // Upload file to Supabase Storage bucket 'portal-attachments'
    const { error } = await supabase.storage
      .from('portal-attachments')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Error uploading file to Supabase Storage:', error.message);
      return null; // Return null instead of throwing — UI layer handles this
    }

    // Get public URL — getPublicUrl is synchronous and does not throw
    const { data } = supabase.storage
      .from('portal-attachments')
      .getPublicUrl(fileName);

    return data?.publicUrl ?? null;
  } catch (error) {
    console.error('Unexpected error uploading file:', error);
    return null;
  }
}

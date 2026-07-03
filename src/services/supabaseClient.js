import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rzdisgzwjrcxykxlsrhd.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_iMU9yknMibEAdLxrRkVyjQ_NtieSKMc';

export const supabase = createClient(supabaseUrl, supabaseKey);

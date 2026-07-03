import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzdisgzwjrcxykxlsrhd.supabase.co';
const supabaseKey = 'sb_publishable_iMU9yknMibEAdLxrRkVyjQ_NtieSKMc';

export const supabase = createClient(supabaseUrl, supabaseKey);

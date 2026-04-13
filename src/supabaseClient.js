import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://osztveumieneolwknhgy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9zenR2ZXVtaWVuZW9sd2tuaGd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNjk0NDAsImV4cCI6MjA5MTY0NTQ0MH0.MScb4SUZhECtCtdfRWlerwCQew1LdSdIhGqCeKVCfMo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://swvjcnamurwnzrsrxgih.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3dmpjbmFtdXJ3bnpyc3J4Z2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTkxODgsImV4cCI6MjEwMDQ3NTE4OH0.8l8U6Zu5knm7UdEoI_KYSnx3ogS8LCCrtU1gXxLDKXg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

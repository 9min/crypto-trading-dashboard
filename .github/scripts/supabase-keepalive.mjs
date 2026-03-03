// =============================================================================
// Supabase Keep-Alive Script
// =============================================================================
// Supabase Free 플랜은 7일간 미사용 시 DB를 정지(pause)합니다.
// 이 스크립트를 5일마다 실행하여 정지를 방지합니다.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const { data, error } = await supabase.from('user_preferences').select('id').limit(1);

if (error) {
  console.error('Supabase query failed:', error.message);
  process.exit(1);
}

console.log(`Supabase ping succeeded — ${data.length} row(s) returned`);

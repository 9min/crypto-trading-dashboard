// =============================================================================
// Supabase Keep-Alive Script
// =============================================================================
// Supabase Free 플랜은 7일간 미사용 시 DB를 정지(pause)합니다.
// 이 스크립트를 3일마다 실행하여 정지를 방지합니다.
// 단순 SELECT는 "sufficient activity"로 인정되지 않으므로
// UPSERT(쓰기) 작업을 수행하여 확실하게 활성 상태를 유지합니다.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Step 1: UPSERT — 쓰기 작업으로 Supabase 활성 상태 유지
const { error: upsertError } = await supabase
  .from('keep_alive')
  .upsert({ id: 1, pinged_at: new Date().toISOString() }, { onConflict: 'id' });

if (upsertError) {
  // keep_alive 테이블이 없으면 SELECT fallback
  console.warn(`Upsert failed (table may not exist): ${upsertError.message}`);
  console.warn('Falling back to SELECT query...');

  const { error: selectError } = await supabase.from('user_preferences').select('id').limit(1);

  if (selectError) {
    console.error('Fallback SELECT also failed:', selectError.message);
    process.exit(1);
  }

  console.warn('Fallback SELECT succeeded. Create "keep_alive" table for reliable keep-alive.');
  console.warn('SQL: CREATE TABLE keep_alive (id int PRIMARY KEY, pinged_at timestamptz);');
  process.exit(0);
}

console.warn(`Supabase keep-alive UPSERT succeeded at ${new Date().toISOString()}`);

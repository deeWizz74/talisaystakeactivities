// migrate-passwords.mjs  — run with: node migrate-passwords.mjs
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabase = createClient(
  'https://wdkyjfuikwamiiblpyio.supabase.co',
  'sb_publishable_f_ENQxmnYqbSaeMxfKN57w_EDJSLdSp'   // use service role key, not anon key
);

const { data: users, error } = await supabase
  .from('profiles')
  .select('id, username, password');

if (error) { console.error(error); process.exit(1); }

for (const user of users) {
  if (user.password?.startsWith('$2b$')) {
    console.log(`⏭  Skipping ${user.username} — already hashed`);
    continue;
  }
  const hashed = await bcrypt.hash(user.password, 10);
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ password: hashed })
    .eq('id', user.id);

  if (updateError) {
    console.error(`✕ Failed ${user.username}:`, updateError.message);
  } else {
    console.log(`✓ Migrated ${user.username}`);
  }
}
console.log('Migration complete.');
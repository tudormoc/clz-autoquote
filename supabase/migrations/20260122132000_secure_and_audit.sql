-- 1. Enable RLS for security (Best Practice)
alter table discount_tiers enable row level security;

-- 2. Allow everyone to READ the discounts (since they are public info)
create policy "Allow public read access"
on discount_tiers for select
to public
using (true);

-- 3. Add column to store FACTUAL discount used (Auditing)
alter table quotes
add column applied_discount numeric;

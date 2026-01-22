-- Add updated_at to discount_tiers
alter table discount_tiers 
add column updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- Create trigger to automatically update updated_at on change
create extension if not exists moddatetime schema extensions;

create trigger handle_updated_at
  before update on discount_tiers
  for each row
  execute procedure moddatetime (updated_at);

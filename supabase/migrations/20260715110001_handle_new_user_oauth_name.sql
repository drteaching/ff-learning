-- Social logins (Google) often set raw_user_meta_data.name / full_name.
-- Keep role default learner — same path as email/password sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, 'learner'), '@', 1)
    ),
    'learner'
  );
  return new;
end;
$$;

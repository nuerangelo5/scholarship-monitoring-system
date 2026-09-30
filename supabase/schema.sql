-- Run once in the Supabase SQL editor. Never expose a service-role key to the browser.
begin;
create table public.scholartrack_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student' check (role in ('admin','staff','student')),
  created_at timestamptz not null default now()
);
create function public.scholartrack_create_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.scholartrack_profiles(id, full_name) values(new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end; $$;
create trigger scholartrack_on_auth_user_created after insert on auth.users for each row execute function public.scholartrack_create_profile();
insert into public.scholartrack_profiles(id, full_name) select id, coalesce(raw_user_meta_data->>'full_name','') from auth.users on conflict do nothing;

create table public.scholartrack_scholars (
 id uuid primary key default gen_random_uuid(),
 student_id text not null unique check(student_id ~ '^[0-9]{4}-[0-9]{4,6}$'),
 full_name text not null check(length(trim(full_name)) between 1 and 120),
 email text not null check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 course text not null check(length(trim(course)) between 1 and 120),
 year_level integer not null check(year_level between 1 and 5),
 status text not null default 'active' check(status in ('active','inactive','graduated')),
 user_id uuid unique references public.scholartrack_profiles(id) on delete set null,
 created_at timestamptz not null default now()
);
create unique index scholartrack_scholars_email_unique on public.scholartrack_scholars(lower(email));
create table public.scholartrack_programs (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(trim(name)) between 1 and 100),
 description text not null default '', award text not null default 'Financial assistance',
 max_gwa numeric(3,2) not null check(max_gwa between 1 and 5),
 min_units integer not null check(min_units between 1 and 40),
 allow_failing boolean not null default false,
 status text not null default 'active' check(status in ('active','inactive')),
 created_at timestamptz not null default now()
);
create unique index scholartrack_programs_name_unique on public.scholartrack_programs(lower(name));
create table public.scholartrack_assignments (
 id uuid primary key default gen_random_uuid(),
 scholar_id uuid not null references public.scholartrack_scholars(id),
 program_id uuid not null references public.scholartrack_programs(id),
 term text not null check(length(trim(term)) between 1 and 80),
 max_gwa numeric(3,2) not null check(max_gwa between 1 and 5),
 min_units integer not null check(min_units between 1 and 40),
 allow_failing boolean not null,
 created_at timestamptz not null default now(),
 unique(scholar_id,term)
);
create table public.scholartrack_submissions (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null unique references public.scholartrack_assignments(id),
 courses jsonb not null check(jsonb_typeof(courses) = 'array'),
 gwa numeric(3,2) not null check(gwa between 1 and 5),
 units numeric(5,1) not null check(units > 0),
 has_failing_grade boolean not null,
 status text not null default 'pending' check(status in ('pending','verified','rejected')),
 feedback text not null default '',
 submitted_by uuid not null references public.scholartrack_profiles(id),
 verified_by uuid references public.scholartrack_profiles(id),
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table public.scholartrack_evaluations (
 id uuid primary key default gen_random_uuid(),
 submission_id uuid not null unique references public.scholartrack_submissions(id),
 status text not null check(status in ('compliant','non_compliant')),
 reasons jsonb not null,
 evaluated_by uuid not null references public.scholartrack_profiles(id),
 created_at timestamptz not null default now()
);
create table public.scholartrack_activity (
 id uuid primary key default gen_random_uuid(),
 message text not null,
 actor_id uuid not null references public.scholartrack_profiles(id),
 created_at timestamptz not null default now()
);
create function public.scholartrack_is_staff() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.scholartrack_profiles where id = auth.uid() and role in ('admin','staff'));
$$;
alter table public.scholartrack_profiles enable row level security;
alter table public.scholartrack_scholars enable row level security;
alter table public.scholartrack_programs enable row level security;
alter table public.scholartrack_assignments enable row level security;
alter table public.scholartrack_submissions enable row level security;
alter table public.scholartrack_evaluations enable row level security;
alter table public.scholartrack_activity enable row level security;
create policy profile_read on public.scholartrack_profiles for select to authenticated using(id=auth.uid() or public.scholartrack_is_staff());
create policy scholar_read on public.scholartrack_scholars for select to authenticated using(user_id=auth.uid() or public.scholartrack_is_staff());
create policy program_read on public.scholartrack_programs for select to authenticated using(true);
create policy assignment_read on public.scholartrack_assignments for select to authenticated using(public.scholartrack_is_staff() or exists(select 1 from public.scholartrack_scholars s where s.id=scholar_id and s.user_id=auth.uid()));
create policy submission_read on public.scholartrack_submissions for select to authenticated using(public.scholartrack_is_staff() or exists(select 1 from public.scholartrack_assignments a join public.scholartrack_scholars s on s.id=a.scholar_id where a.id=assignment_id and s.user_id=auth.uid()));
create policy evaluation_read on public.scholartrack_evaluations for select to authenticated using(public.scholartrack_is_staff() or exists(select 1 from public.scholartrack_submissions g join public.scholartrack_assignments a on a.id=g.assignment_id join public.scholartrack_scholars s on s.id=a.scholar_id where g.id=submission_id and s.user_id=auth.uid()));
create policy activity_read on public.scholartrack_activity for select to authenticated using(public.scholartrack_is_staff() or actor_id=auth.uid());

-- All writes pass through this function; client-supplied GWA and compliance are ignored.
create function public.scholartrack_action(p_action text, p_data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
 v_staff boolean; v_s public.scholartrack_scholars; v_p public.scholartrack_programs; v_a public.scholartrack_assignments; v_g public.scholartrack_submissions;
 v_item jsonb; v_code text; v_codes text[] := '{}'; v_grade numeric; v_units numeric;
 v_total numeric := 0; v_weighted numeric := 0; v_failing boolean := false;
 v_reasons jsonb := '[]'; v_message text; v_user uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to continue'; end if;
 v_staff := public.scholartrack_is_staff();
 if not v_staff and p_action <> 'submit_grades' then raise exception 'Staff access is required'; end if;
 if p_action='register_scholar' then
   select id into v_user from auth.users where lower(email)=lower(trim(p_data->>'email'));
   insert into public.scholartrack_scholars(student_id,full_name,email,course,year_level,user_id)
   values(trim(p_data->>'student_id'),trim(p_data->>'full_name'),lower(trim(p_data->>'email')),trim(p_data->>'course'),(p_data->>'year_level')::integer,v_user);
   v_message := 'Registered ' || trim(p_data->>'full_name');
 elsif p_action='create_program' then
   insert into public.scholartrack_programs(name,description,award,max_gwa,min_units,allow_failing)
   values(trim(p_data->>'name'),coalesce(p_data->>'description',''),coalesce(p_data->>'award','Financial assistance'),(p_data->>'max_gwa')::numeric,(p_data->>'min_units')::integer,(p_data->>'allow_failing')::boolean);
   v_message := 'Created ' || trim(p_data->>'name');
 elsif p_action='assign_scholarship' then
   select * into v_s from public.scholartrack_scholars where id=(p_data->>'scholar_id')::uuid for update;
   select * into v_p from public.scholartrack_programs where id=(p_data->>'program_id')::uuid for share;
   if v_s.id is null or v_p.id is null or v_s.status<>'active' or v_p.status<>'active' then raise exception 'Select an active scholar and scholarship'; end if;
   insert into public.scholartrack_assignments(scholar_id,program_id,term,max_gwa,min_units,allow_failing)
   values(v_s.id,v_p.id,trim(p_data->>'term'),v_p.max_gwa,v_p.min_units,v_p.allow_failing);
   v_message := 'Assigned ' || v_p.name || ' to ' || v_s.full_name;
 elsif p_action='submit_grades' then
   select * into v_a from public.scholartrack_assignments where id=(p_data->>'assignment_id')::uuid for update;
   if v_a.id is null then raise exception 'Assignment not found'; end if;
   select * into v_s from public.scholartrack_scholars where id=v_a.scholar_id;
   if not v_staff and v_s.user_id is distinct from auth.uid() then raise exception 'You can submit only your own grades'; end if;
   if v_s.status <> 'active' then raise exception 'Scholar must be active'; end if;
   select * into v_g from public.scholartrack_submissions where assignment_id=v_a.id for update;
   if v_g.id is not null and v_g.status<>'rejected' then raise exception 'Only returned submissions can be resubmitted'; end if;
   if p_data->'courses' is null or jsonb_typeof(p_data->'courses') <> 'array' then raise exception 'Courses must be an array'; end if;
   if jsonb_array_length(p_data->'courses') not between 1 and 15 then raise exception 'Enter 1–15 courses'; end if;
   for v_item in select * from jsonb_array_elements(p_data->'courses') loop
     v_code := upper(trim(v_item->>'code'));
     v_grade := (v_item->>'grade')::numeric; v_units := (v_item->>'units')::numeric;
     if v_code is null or length(v_code) not between 1 and 40 or v_code=any(v_codes) then raise exception 'Course codes must be unique and 1–40 characters'; end if;
     if v_grade is null or not(v_grade between 1 and 5) then raise exception 'Grades must be 1.00–5.00'; end if;
     if v_units is null or not(v_units between 1 and 12) or mod(v_units*2,1)<>0 then raise exception 'Units must be 1–12 in half-unit increments'; end if;
     v_codes := array_append(v_codes,v_code); v_total := v_total+v_units; v_weighted := v_weighted+v_grade*v_units;
     v_failing := v_failing or v_grade>3;
   end loop;
   if v_g.id is null then
     insert into public.scholartrack_submissions(assignment_id,courses,gwa,units,has_failing_grade,submitted_by)
     values(v_a.id,p_data->'courses',round(v_weighted/v_total,2),v_total,v_failing,auth.uid());
   else
     update public.scholartrack_submissions set courses=p_data->'courses',gwa=round(v_weighted/v_total,2),units=v_total,has_failing_grade=v_failing,status='pending',feedback='',submitted_by=auth.uid(),verified_by=null,verified_at=null,created_at=now() where id=v_g.id;
   end if;
   v_message := 'Submitted grades for verification';
 elsif p_action='verify_grades' then
   select * into v_g from public.scholartrack_submissions where id=(p_data->>'submission_id')::uuid for update;
   if v_g.id is null or v_g.status<>'pending' then raise exception 'Only pending submissions can be reviewed'; end if;
   if p_data->>'status' is null or p_data->>'status' not in ('verified','rejected') then raise exception 'Invalid decision'; end if;
   if p_data->>'status'='rejected' and coalesce(length(trim(p_data->>'feedback')),0)=0 then raise exception 'Feedback is required when returning grades'; end if;
   update public.scholartrack_submissions set status=p_data->>'status',feedback=coalesce(p_data->>'feedback',''),verified_by=auth.uid(),verified_at=now() where id=v_g.id;
   v_message := case when p_data->>'status'='verified' then 'Verified academic grades' else 'Returned grades for correction' end;
 elsif p_action='evaluate_compliance' then
   select * into v_g from public.scholartrack_submissions where id=(p_data->>'submission_id')::uuid for update;
   if v_g.id is null or v_g.status<>'verified' then raise exception 'Verify grades before evaluation'; end if;
   select * into v_a from public.scholartrack_assignments where id=v_g.assignment_id;
   if v_g.gwa>v_a.max_gwa then v_reasons := v_reasons || jsonb_build_array('GWA exceeds ' || v_a.max_gwa); end if;
   if v_g.units<v_a.min_units then v_reasons := v_reasons || jsonb_build_array('Below ' || v_a.min_units || ' required units'); end if;
   if not v_a.allow_failing and v_g.has_failing_grade then v_reasons := v_reasons || '["Failing grade is not allowed"]'::jsonb; end if;
   insert into public.scholartrack_evaluations(submission_id,status,reasons,evaluated_by)
   values(v_g.id,case when jsonb_array_length(v_reasons)=0 then 'compliant' else 'non_compliant' end,v_reasons,auth.uid());
   v_message := 'Evaluated scholarship compliance';
 else raise exception 'Unknown action'; end if;
 insert into public.scholartrack_activity(message,actor_id) values(v_message,auth.uid());
end; $$;
revoke all on public.scholartrack_profiles,public.scholartrack_scholars,public.scholartrack_programs,public.scholartrack_assignments,public.scholartrack_submissions,public.scholartrack_evaluations,public.scholartrack_activity from anon;
revoke all on public.scholartrack_profiles,public.scholartrack_scholars,public.scholartrack_programs,public.scholartrack_assignments,public.scholartrack_submissions,public.scholartrack_evaluations,public.scholartrack_activity from authenticated;
grant select on public.scholartrack_profiles,public.scholartrack_scholars,public.scholartrack_programs,public.scholartrack_assignments,public.scholartrack_submissions,public.scholartrack_evaluations,public.scholartrack_activity to authenticated;
revoke all on function public.scholartrack_action(text,jsonb) from public, anon;
grant execute on function public.scholartrack_action(text,jsonb) to authenticated;
revoke all on function public.scholartrack_is_staff() from public, anon;
grant execute on function public.scholartrack_is_staff() to authenticated;
revoke all on function public.scholartrack_create_profile() from public, anon, authenticated;
commit;

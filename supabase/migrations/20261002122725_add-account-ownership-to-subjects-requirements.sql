alter table public.subjects
	add column if not exists account_username text;

alter table public.requirements
	add column if not exists account_username text;

update public.subjects
set account_username = 'christiancervantes'
where account_username is null;

update public.requirements as requirement
set account_username = subject.account_username
from public.subjects as subject
where requirement.subject_id = subject.id
	and requirement.account_username is null;

alter table public.subjects
	alter column account_username set not null;

alter table public.requirements
	alter column account_username set not null;

create index if not exists subjects_account_username_idx
	on public.subjects(account_username);

create index if not exists requirements_account_username_idx
	on public.requirements(account_username);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.subject_sections, public.subjects, public.requirements to anon, authenticated;

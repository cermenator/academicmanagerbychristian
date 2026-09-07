alter table public.subject_sections
	add column account_username text;

update public.subject_sections
set account_username = 'christiancervantes'
where account_username is null;

alter table public.subject_sections
	alter column account_username set not null;

create index subject_sections_account_username_idx
	on public.subject_sections(account_username);

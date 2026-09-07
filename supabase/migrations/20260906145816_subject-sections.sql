create table public.subject_sections (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	sort_order integer not null default 0,
	created_at timestamptz not null default now()
);

alter table public.subjects
	add column section_id uuid references public.subject_sections(id) on delete set null,
	add column sort_order integer not null default 0;

alter table public.subject_sections enable row level security;

create policy "prototype subject sections access" on public.subject_sections
	for all to anon, authenticated
	using (true) with check (true);

insert into public.subject_sections (id, name, sort_order)
values
	('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'My Subjects', 0),
	('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'More Subjects', 1);

update public.subjects
set section_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where section_id is null;

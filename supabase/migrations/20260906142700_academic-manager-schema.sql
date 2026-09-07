create table public.subjects (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	code text,
	color text not null default '#2563eb',
	created_at timestamptz not null default now()
);

create table public.requirements (
	id uuid primary key default gen_random_uuid(),
	subject_id uuid not null references public.subjects(id) on delete cascade,
	category text not null check (category in ('Module', 'Task', 'Activity', 'Others')),
	title text not null,
	description text,
	deadline date not null,
	priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
	status text not null default 'Pending' check (status in ('Pending', 'Submitted')),
	submitted_at timestamptz,
	files jsonb not null default '[]'::jsonb,
	created_at timestamptz not null default now()
);

create index requirements_subject_id_idx on public.requirements(subject_id);
create index requirements_deadline_idx on public.requirements(deadline);

alter table public.subjects enable row level security;
alter table public.requirements enable row level security;

create policy "prototype subjects access" on public.subjects
	for all to anon, authenticated
	using (true) with check (true);

create policy "prototype requirements access" on public.requirements
	for all to anon, authenticated
	using (true) with check (true);

insert into public.subjects (id, name, code, color)
values
	('11111111-1111-1111-1111-111111111111', 'Business Finance', 'FIN 101', '#2563eb'),
	('22222222-2222-2222-2222-222222222222', 'Web Development', 'IT 201', '#7c3aed');

insert into public.requirements (subject_id, category, title, description, deadline, priority)
values
	('11111111-1111-1111-1111-111111111111', 'Module', 'Module 1 – Introduction to Business Finance', 'Read the module and review the examples.', '2026-09-10', 'High'),
	('11111111-1111-1111-1111-111111111111', 'Activity', 'Activity 1 – Financial Decisions', 'Answer the guide questions.', '2026-09-12', 'Medium'),
	('22222222-2222-2222-2222-222222222222', 'Task', 'HTML/CSS Practice', 'Create the required webpage.', '2026-09-18', 'High');

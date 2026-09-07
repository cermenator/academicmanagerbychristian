-- Remove only the two records created by the original demo seed.
delete from public.subjects
where id in (
	'11111111-1111-1111-1111-111111111111',
	'22222222-2222-2222-2222-222222222222'
);

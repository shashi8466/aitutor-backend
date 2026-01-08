-- Update the 'documents' bucket to allow larger files (e.g., 3GB)
update storage.buckets
set file_size_limit = 3221225472 -- 3GB in bytes
where name = 'documents';

-- Safely ensure the limit is set even if row was locked or other issue
-- (Idempotent update)
insert into storage.buckets (id, name, file_size_limit)
values ('documents', 'documents', 3221225472)
on conflict (id) do update
set file_size_limit = 3221225472;

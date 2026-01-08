-- Force update the 'documents' bucket to 10GB limit to rule out configuration issues
update storage.buckets
set file_size_limit = 10737418240 -- 10GB in bytes
where name = 'documents';

-- Also ensure it is public
update storage.buckets
set public = true
where name = 'documents';

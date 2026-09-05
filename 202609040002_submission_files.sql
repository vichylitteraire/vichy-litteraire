alter table public.letter_submissions add column if not exists document_path text;
alter table public.letter_submissions add column if not exists document_name text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('letter-submissions','letter-submissions',false,5242880,array['text/plain','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=excluded.allowed_mime_types;

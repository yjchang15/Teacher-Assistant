-- Merge English speaking practice into the existing Teacher-Assistant project.
-- Run once in the Supabase SQL Editor before the first Vercel deployment.

BEGIN;

CREATE TABLE IF NOT EXISTS public.speaking_articles (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    content    text NOT NULL,
    created_at text NOT NULL DEFAULT '',
    updated_at text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.speaking_practice_records (
    id          text PRIMARY KEY,
    class_id    bigint REFERENCES public.classes(id) ON DELETE SET NULL,
    class_name  text NOT NULL,
    seat         integer NOT NULL CHECK (seat BETWEEN 1 AND 60),
    record_data jsonb NOT NULL CHECK (jsonb_typeof(record_data) = 'object'),
    created_at  text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS speaking_records_class_created
    ON public.speaking_practice_records (class_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.speaking_practice_record_backups (
    id         text PRIMARY KEY,
    records    jsonb NOT NULL,
    created_at text NOT NULL DEFAULT ''
);

-- Vercel connects with the server-side Postgres connection string. The browser
-- does not use Supabase Data API keys, so anon/authenticated need no table access.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_practice_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaking_practice_record_backups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.app_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.accounts FROM anon, authenticated;
REVOKE ALL ON TABLE public.classes FROM anon, authenticated;
REVOKE ALL ON TABLE public.class_seats FROM anon, authenticated;
REVOKE ALL ON TABLE public.assignments FROM anon, authenticated;
REVOKE ALL ON TABLE public.assignment_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.speaking_articles FROM anon, authenticated;
REVOKE ALL ON TABLE public.speaking_practice_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.speaking_practice_record_backups FROM anon, authenticated;

COMMIT;

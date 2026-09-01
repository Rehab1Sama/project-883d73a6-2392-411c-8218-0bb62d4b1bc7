ALTER TABLE public.tracks ADD COLUMN IF NOT EXISTS categories public.track_category[] NOT NULL DEFAULT '{}';
UPDATE public.tracks SET categories = ARRAY[category] WHERE cardinality(categories) = 0;

ALTER TABLE public.quotas ADD COLUMN IF NOT EXISTS category public.track_category;
ALTER TABLE public.progress_records ADD COLUMN IF NOT EXISTS category public.track_category;

ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS setup_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS compare_lifetime numeric;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  identifier text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, identifier)
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rate_limit_hit(_bucket text, _identifier text, _limit integer, _window_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _hits integer;
BEGIN
  INSERT INTO public.rate_limits (bucket, identifier, window_start, hits)
  VALUES (_bucket, _identifier, now(), 1)
  ON CONFLICT (bucket, identifier) DO UPDATE
    SET hits = CASE
          WHEN public.rate_limits.window_start < now() - make_interval(secs => _window_seconds) THEN 1
          ELSE public.rate_limits.hits + 1
        END,
        window_start = CASE
          WHEN public.rate_limits.window_start < now() - make_interval(secs => _window_seconds) THEN now()
          ELSE public.rate_limits.window_start
        END,
        updated_at = now()
  RETURNING hits INTO _hits;

  RETURN _hits <= _limit;
END;
$$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.rate_limit_hit(text, text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, text, integer, integer) TO service_role;
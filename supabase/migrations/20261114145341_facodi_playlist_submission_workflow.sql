
-- FACODI-owned playlists. Tube owns only the shared video catalogue (public.videos).
-- Existing public.playlists, public.playlist_videos and the Tube submission pipeline stay unchanged.
ALTER TABLE facodi.curricular_units
  ADD CONSTRAINT facodi_curricular_units_course_id_id_key UNIQUE (course_id, id);

CREATE TABLE facodi.playlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES facodi.courses(id) ON DELETE RESTRICT,
  curricular_unit_id uuid NOT NULL,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  language text NOT NULL DEFAULT 'pt' CHECK (language ~ '^[a-z]{2,3}(-[a-z]{2})?$'),
  youtube_playlist_id text NOT NULL
    CHECK (youtube_playlist_id ~ '^[A-Za-z0-9_-]{10,120}$'),
  source_url text GENERATED ALWAYS AS
    ('https://www.youtube.com/playlist?list=' || youtube_playlist_id) STORED,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  import_status text NOT NULL DEFAULT 'pending'
    CHECK (import_status IN ('pending', 'partial', 'completed', 'failed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text CHECK (review_note IS NULL OR length(review_note) <= 2000),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT facodi_playlist_course_unit_fk
    FOREIGN KEY (course_id, curricular_unit_id)
    REFERENCES facodi.curricular_units (course_id, id) ON DELETE RESTRICT,
  CONSTRAINT facodi_playlist_review_consistency
    CHECK ((status='pending' AND reviewed_at IS NULL AND reviewed_by IS NULL) OR
           (status<>'pending' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
CREATE UNIQUE INDEX facodi_playlist_submitter_source_active_idx
 ON facodi.playlists(submitted_by,curricular_unit_id,youtube_playlist_id)
 WHERE status IN ('pending','approved');
CREATE INDEX facodi_playlists_unit_status_idx
 ON facodi.playlists(curricular_unit_id,status,submitted_at DESC);
CREATE INDEX facodi_playlists_author_created_idx
 ON facodi.playlists(submitted_by,submitted_at DESC);
CREATE INDEX facodi_playlists_reviewer_idx ON facodi.playlists(reviewed_by);

CREATE TABLE facodi.playlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id uuid NOT NULL REFERENCES facodi.playlists(id) ON DELETE CASCADE,
  youtube_video_id text NOT NULL CHECK (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  video_id uuid REFERENCES public.videos(id) ON DELETE SET NULL,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 99),
  review_status text NOT NULL DEFAULT 'pending'
    CHECK (review_status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (playlist_id,youtube_video_id),
  UNIQUE (playlist_id,position)
);
CREATE UNIQUE INDEX facodi_playlist_items_playlist_video_idx
 ON facodi.playlist_items(playlist_id,video_id) WHERE video_id IS NOT NULL;
CREATE INDEX facodi_playlist_items_video_fk_idx ON facodi.playlist_items(video_id);

-- Invoker triggers: do not bypass RLS or use a SECURITY DEFINER privilege escalator.
CREATE FUNCTION facodi.playlist_submission_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR new.submitted_by <> v_user THEN
    RAISE EXCEPTION 'Authenticated submitter required' USING ERRCODE='42501';
  END IF;
  IF NOT (SELECT facodi.is_facodi_editor()) THEN
    -- Serialize submission counters per account against concurrent bursts.
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 20261114));
    IF (SELECT count(*) FROM facodi.playlists
        WHERE submitted_by=v_user AND submitted_at>now()-interval '1 hour') >= 3
      OR (SELECT count(*) FROM facodi.playlists
          WHERE submitted_by=v_user AND submitted_at>now()-interval '1 day') >= 10 THEN
      RAISE EXCEPTION 'Playlist submission rate limit exceeded' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER facodi_playlist_submission_guard
 BEFORE INSERT ON facodi.playlists
 FOR EACH ROW EXECUTE FUNCTION facodi.playlist_submission_guard();

CREATE FUNCTION facodi.playlist_item_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF new.video_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.videos v
    WHERE v.id=new.video_id AND v.youtube_id=new.youtube_video_id
  ) THEN
    RAISE EXCEPTION 'video_id does not match youtube_video_id' USING ERRCODE='23514';
  END IF;
  RETURN new;
END $$;
CREATE TRIGGER facodi_playlist_item_guard
 BEFORE INSERT OR UPDATE OF video_id,youtube_video_id ON facodi.playlist_items
 FOR EACH ROW EXECUTE FUNCTION facodi.playlist_item_guard();

CREATE TRIGGER facodi_playlist_updated_at
 BEFORE UPDATE ON facodi.playlists
 FOR EACH ROW EXECUTE FUNCTION facodi.set_updated_at();
CREATE TRIGGER facodi_playlist_items_updated_at
 BEFORE UPDATE ON facodi.playlist_items
 FOR EACH ROW EXECUTE FUNCTION facodi.set_updated_at();

ALTER TABLE facodi.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE facodi.playlist_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON facodi.playlists,facodi.playlist_items FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON facodi.playlists TO authenticated;
GRANT UPDATE(status,import_status,reviewed_by,reviewed_at,review_note,updated_at)
 ON facodi.playlists TO authenticated;
GRANT SELECT ON facodi.playlists TO anon;
GRANT SELECT,INSERT ON facodi.playlist_items TO authenticated;
GRANT UPDATE(video_id,position,review_status,updated_at) ON facodi.playlist_items TO authenticated;
GRANT SELECT ON facodi.playlist_items TO anon;

CREATE POLICY facodi_playlist_read_private_or_published ON facodi.playlists
 FOR SELECT TO authenticated USING (
   submitted_by=(SELECT auth.uid()) OR (SELECT facodi.is_facodi_editor()) OR
   (status='approved' AND EXISTS(
     SELECT 1 FROM facodi.curricular_units u
     JOIN facodi.courses c ON c.id=u.course_id
     WHERE u.id=curricular_unit_id
       AND u.published=true AND u.status='active'
       AND c.published=true AND c.status='active'
   ))
 );
CREATE POLICY facodi_playlist_read_published_anon ON facodi.playlists
 FOR SELECT TO anon USING (
   status='approved' AND EXISTS(
     SELECT 1 FROM facodi.curricular_units u
     JOIN facodi.courses c ON c.id=u.course_id
     WHERE u.id=curricular_unit_id
       AND u.published=true AND u.status='active'
       AND c.published=true AND c.status='active'
   )
 );
CREATE POLICY facodi_playlist_insert_own ON facodi.playlists
 FOR INSERT TO authenticated WITH CHECK (
   submitted_by=(SELECT auth.uid())
   AND status='pending' AND import_status IN ('pending','partial','completed','failed')
   AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL
   AND (
     (SELECT facodi.is_facodi_editor()) OR
     EXISTS (SELECT 1 FROM facodi.curricular_units u
             JOIN facodi.courses c ON c.id=u.course_id
             WHERE u.id=curricular_unit_id AND u.course_id=course_id
               AND u.published=true AND u.status='active'
               AND c.published=true AND c.status='active')
   )
 );
CREATE POLICY facodi_playlist_editor_update ON facodi.playlists
 FOR UPDATE TO authenticated
 USING ((SELECT facodi.is_facodi_editor()))
 WITH CHECK ((SELECT facodi.is_facodi_editor()));

CREATE POLICY facodi_playlist_items_read_own_or_editor ON facodi.playlist_items
 FOR SELECT TO authenticated USING (
   EXISTS(SELECT 1 FROM facodi.playlists p WHERE p.id=playlist_id
          AND (p.submitted_by=(SELECT auth.uid()) OR (SELECT facodi.is_facodi_editor())))
   OR (review_status='approved' AND video_id IS NOT NULL
       AND EXISTS(SELECT 1 FROM facodi.playlists p
                  WHERE p.id=playlist_id AND p.status='approved'))
 );
CREATE POLICY facodi_playlist_items_read_published_anon ON facodi.playlist_items
 FOR SELECT TO anon USING (
   review_status='approved' AND video_id IS NOT NULL
   AND EXISTS(SELECT 1 FROM facodi.playlists p WHERE p.id=playlist_id AND p.status='approved')
 );
CREATE POLICY facodi_playlist_items_insert_own_pending ON facodi.playlist_items
 FOR INSERT TO authenticated WITH CHECK (
   review_status='pending'
   AND EXISTS(SELECT 1 FROM facodi.playlists p
              WHERE p.id=playlist_id AND p.status='pending'
                AND (p.submitted_by=(SELECT auth.uid()) OR (SELECT facodi.is_facodi_editor())))
 );
CREATE POLICY facodi_playlist_items_editor_update ON facodi.playlist_items
 FOR UPDATE TO authenticated
 USING ((SELECT facodi.is_facodi_editor()))
 WITH CHECK ((SELECT facodi.is_facodi_editor()));
CREATE POLICY facodi_playlist_items_owner_reconcile ON facodi.playlist_items
 FOR UPDATE TO authenticated
 USING (review_status='pending' AND EXISTS(
   SELECT 1 FROM facodi.playlists p
   WHERE p.id=playlist_id AND p.status='pending' AND p.submitted_by=(SELECT auth.uid())))
 WITH CHECK (review_status='pending' AND EXISTS(
   SELECT 1 FROM facodi.playlists p
   WHERE p.id=playlist_id AND p.status='pending' AND p.submitted_by=(SELECT auth.uid())));

-- Atomic creation of playlist + imported items, executed as the signed-in user.
CREATE FUNCTION facodi.submit_playlist(
  p_course_id uuid,
  p_curricular_unit_id uuid,
  p_youtube_playlist_id text,
  p_title text,
  p_youtube_video_ids text[] DEFAULT '{}'::text[],
  p_description text DEFAULT NULL,
  p_language text DEFAULT 'pt'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = '' AS $$
DECLARE
  v_user uuid := auth.uid();
  v_playlist_id uuid;
  v_ids text[] := coalesce(p_youtube_video_ids,'{}'::text[]);
  v_total integer;
  v_matched integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_course_id IS NULL OR p_curricular_unit_id IS NULL THEN
    RAISE EXCEPTION 'Course and curricular unit are required' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM facodi.curricular_units u
                 WHERE u.id=p_curricular_unit_id AND u.course_id=p_course_id) THEN
    RAISE EXCEPTION 'Curricular unit does not belong to course, or is unavailable' USING ERRCODE='22023';
  END IF;
  IF p_youtube_playlist_id IS NULL OR p_youtube_playlist_id !~ '^[A-Za-z0-9_-]{10,120}$' THEN
    RAISE EXCEPTION 'Invalid YouTube playlist id' USING ERRCODE='22023';
  END IF;
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 3 AND 200 THEN
    RAISE EXCEPTION 'Playlist title must have 3 to 200 characters' USING ERRCODE='22023';
  END IF;
  IF pg_catalog.array_length(v_ids,1)>100 OR
     EXISTS(SELECT 1 FROM pg_catalog.unnest(v_ids) AS x(yid)
            WHERE yid IS NULL OR yid !~ '^[A-Za-z0-9_-]{11}$') THEN
    RAISE EXCEPTION 'Playlist videos must be valid YouTube IDs (maximum 100)' USING ERRCODE='22023';
  END IF;

  SELECT id INTO v_playlist_id
  FROM facodi.playlists
  WHERE submitted_by=v_user AND curricular_unit_id=p_curricular_unit_id
    AND youtube_playlist_id=p_youtube_playlist_id
    AND status IN ('pending','approved')
  ORDER BY submitted_at DESC LIMIT 1;
  IF v_playlist_id IS NOT NULL THEN RETURN v_playlist_id; END IF;

  INSERT INTO facodi.playlists
    (course_id,curricular_unit_id,submitted_by,youtube_playlist_id,title,description,language)
  VALUES
    (p_course_id,p_curricular_unit_id,v_user,p_youtube_playlist_id,btrim(p_title),
     p_description,coalesce(p_language,'pt'))
  ON CONFLICT DO NOTHING RETURNING id INTO v_playlist_id;

  IF v_playlist_id IS NULL THEN
    SELECT id INTO v_playlist_id FROM facodi.playlists
    WHERE submitted_by=v_user AND curricular_unit_id=p_curricular_unit_id
      AND youtube_playlist_id=p_youtube_playlist_id AND status IN ('pending','approved')
    ORDER BY submitted_at DESC LIMIT 1;
    IF v_playlist_id IS NULL THEN RAISE EXCEPTION 'Unable to create playlist'; END IF;
    RETURN v_playlist_id;
  END IF;

  INSERT INTO facodi.playlist_items(playlist_id,youtube_video_id,video_id,position)
  SELECT v_playlist_id, ranked.yid,v.id, ranked.pos
  FROM (
    SELECT yid,(row_number() OVER (ORDER BY ord)-1)::int AS pos
    FROM (
      SELECT DISTINCT ON (yid) yid,ord
      FROM pg_catalog.unnest(v_ids) WITH ORDINALITY AS t(yid,ord)
      ORDER BY yid,ord
    ) dedup
  ) ranked
  LEFT JOIN public.videos v ON v.youtube_id=ranked.yid
  ORDER BY ranked.pos;

  SELECT count(*),count(video_id)
    INTO v_total,v_matched FROM facodi.playlist_items WHERE playlist_id=v_playlist_id;
  UPDATE facodi.playlists SET import_status=
    CASE WHEN v_total=0 THEN 'pending'
         WHEN v_total=v_matched THEN 'completed'
         ELSE 'partial' END
  WHERE id=v_playlist_id;
  -- For non-editors the UPDATE policy is denied; import_status will be finalized
  -- separately via the permitted import-finish RPC only if needed.
  RETURN v_playlist_id;
END $$;

-- Attach video IDs newly imported into public.videos to previously unmatched playlist items.
CREATE FUNCTION facodi.reconcile_playlist_items(p_playlist_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_updated integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM facodi.playlists p WHERE p.id=p_playlist_id
    AND p.status='pending'
    AND (p.submitted_by=auth.uid() OR (SELECT facodi.is_facodi_editor()))) THEN
    RAISE EXCEPTION 'Playlist not found or not editable' USING ERRCODE='42501';
  END IF;
  UPDATE facodi.playlist_items pi
  SET video_id=v.id
  FROM public.videos v
  WHERE pi.playlist_id=p_playlist_id
    AND pi.video_id IS NULL AND pi.youtube_video_id=v.youtube_id;
  GET DIAGNOSTICS v_updated=ROW_COUNT;
  RETURN v_updated;
END $$;

-- Only FACODI editors can moderate; approval publishes mappings to facodi.unit_videos.
CREATE FUNCTION facodi.review_playlist(
  p_playlist_id uuid,
  p_decision text,
  p_review_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE
 v_playlist facodi.playlists%ROWTYPE;
 v_ready integer;
 v_missing integer;
BEGIN
 IF auth.uid() IS NULL OR NOT (SELECT facodi.is_facodi_editor()) THEN
   RAISE EXCEPTION 'FACODI editor permission required' USING ERRCODE='42501';
 END IF;
 IF p_decision NOT IN ('approved','rejected') THEN
   RAISE EXCEPTION 'Decision must be approved or rejected' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_playlist FROM facodi.playlists WHERE id=p_playlist_id FOR UPDATE;
 IF NOT FOUND OR v_playlist.status<>'pending' THEN
   RAISE EXCEPTION 'Playlist missing or already reviewed' USING ERRCODE='22023';
 END IF;
 IF p_decision='approved' THEN
   SELECT count(*) FILTER(WHERE video_id IS NOT NULL),
          count(*) FILTER(WHERE video_id IS NULL)
   INTO v_ready,v_missing FROM facodi.playlist_items
   WHERE playlist_id=p_playlist_id AND review_status<>'rejected';
   IF v_ready=0 OR v_missing>0 THEN
     RAISE EXCEPTION 'Cannot approve until all accepted videos are in public.videos' USING ERRCODE='22023';
   END IF;
   UPDATE facodi.playlist_items SET review_status='approved'
   WHERE playlist_id=p_playlist_id AND review_status='pending' AND video_id IS NOT NULL;
   INSERT INTO facodi.unit_videos
     (curricular_unit_id,video_id,position,created_by,metadata)
   SELECT v_playlist.curricular_unit_id,i.video_id,i.position,auth.uid(),
     pg_catalog.jsonb_build_object(
       'source','facodi.playlists','source_playlist_id',v_playlist.id,
       'review_status','approved','reviewed_by',auth.uid())
   FROM facodi.playlist_items i
   WHERE i.playlist_id=p_playlist_id AND i.review_status='approved'
     AND i.video_id IS NOT NULL
   ON CONFLICT(curricular_unit_id,video_id) DO UPDATE
     SET metadata=facodi.unit_videos.metadata ||
       pg_catalog.jsonb_build_object('review_status','approved',
         'approved_playlist_id',v_playlist.id,'reviewed_by',auth.uid());
 END IF;
 UPDATE facodi.playlists SET
   status=p_decision,review_note=p_review_note,
   reviewed_at=now(),reviewed_by=auth.uid()
 WHERE id=p_playlist_id;
 RETURN p_playlist_id;
END $$;

REVOKE ALL ON FUNCTION facodi.submit_playlist(uuid,uuid,text,text,text[],text,text),
 facodi.reconcile_playlist_items(uuid),facodi.review_playlist(uuid,text,text)
 FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION facodi.submit_playlist(uuid,uuid,text,text,text[],text,text),
 facodi.reconcile_playlist_items(uuid),facodi.review_playlist(uuid,text,text)
 TO authenticated;


-- Owner may only update the import status while the playlist remains in moderation.
-- Any attempt to approve, reject, or forge reviewer fields fails the RLS WITH CHECK.
CREATE POLICY facodi_playlist_owner_pending_import_status
ON facodi.playlists FOR UPDATE TO authenticated
USING (submitted_by=(SELECT auth.uid()) AND status='pending'
       AND reviewed_by IS NULL AND reviewed_at IS NULL)
WITH CHECK (submitted_by=(SELECT auth.uid()) AND status='pending'
            AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_note IS NULL);

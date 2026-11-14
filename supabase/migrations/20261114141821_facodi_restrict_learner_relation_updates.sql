-- Harden learner-owned rows: UUID identity and relationship columns are immutable.
-- Only the editable state/progress columns can be changed from the client.
revoke update on facodi.enrollments from authenticated;
grant update(status,updated_at) on facodi.enrollments to authenticated;
revoke update on facodi.video_progress from authenticated;
grant update(last_position_seconds,completed_at,updated_at) on facodi.video_progress to authenticated;

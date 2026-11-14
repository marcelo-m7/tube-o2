-- Remove only FACODI Odoo integration structures after confirming zero rows.
-- Keep public tables and independent Tube data untouched.
drop function if exists facodi.get_odoo_sync_job_status(uuid);
drop function if exists facodi.queue_odoo_sync_job(text,uuid,uuid,uuid,uuid,jsonb);
drop function if exists facodi.register_odoo_mapping(text,text,text,jsonb,jsonb,uuid,uuid,integer,text,jsonb);
drop table if exists facodi.odoo_sync_logs restrict;
drop table if exists facodi.odoo_sync_jobs restrict;
drop table if exists facodi.odoo_records restrict;
drop table if exists facodi.odoo_model_maps restrict;
drop table if exists facodi.odoo_instances restrict;
alter table facodi.courses drop column if exists odoo_channel_id;
alter table facodi.curricular_units drop column if exists odoo_slide_id;

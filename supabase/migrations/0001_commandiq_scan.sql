-- CommandIQ Scan schema.
-- Reuses the existing ojt_profiles role model for write authorization; public
-- (anon) users can read only published content. Apply via the Supabase SQL
-- editor or `supabase db push`.

-- === Tables ===

create table if not exists scan_components (
  id                 uuid primary key default gen_random_uuid(),
  aircraft           text not null,
  area               text not null,
  system             text,
  name               text not null,
  alternate_names    text[],
  description        text,
  function           text,
  location           text,
  related_components text[],
  safety_notes       text,
  cautions           text,
  to_refs            text[],
  job_guide_refs     text[],
  imi_links          text[],
  animation_links    text[],
  resolve_path_ids   text[],
  label_type         text not null default 'interactive'
                       check (label_type in ('informational','interactive')),
  validation_status  text not null default 'draft'
                       check (validation_status in ('draft','submitted','approved','returned')),
  content_owner      text,
  is_published       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists scan_components_area_idx
  on scan_components (aircraft, area) where is_published;

create table if not exists scan_areas (
  id          uuid primary key default gen_random_uuid(),
  aircraft    text not null,
  area        text not null,
  system      text,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

-- Maps a detector's class label to a component, so the recognition model and the
-- content rows evolve independently.
create table if not exists scan_detections (
  id           uuid primary key default gen_random_uuid(),
  class_label  text not null,
  component_id uuid not null references scan_components(id) on delete cascade,
  aircraft     text not null,
  area         text not null,
  unique (aircraft, area, class_label)
);

-- === updated_at trigger ===

create or replace function scan_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists scan_components_touch on scan_components;
create trigger scan_components_touch before update on scan_components
  for each row execute function scan_touch_updated_at();

-- === Authorization helper ===
-- True when the current auth user is an admin or supervisor (acting as SME).

create or replace function is_scan_editor() returns boolean as $$
  select exists (
    select 1 from ojt_profiles
    where user_id = auth.uid()
      and role in ('admin','supervisor')
  );
$$ language sql security definer stable;

-- === RLS ===

alter table scan_components enable row level security;
alter table scan_areas      enable row level security;
alter table scan_detections enable row level security;

-- Public read of published content; editors read everything.
drop policy if exists scan_components_read on scan_components;
create policy scan_components_read on scan_components
  for select using (is_published or is_scan_editor());

drop policy if exists scan_components_write on scan_components;
create policy scan_components_write on scan_components
  for all using (is_scan_editor()) with check (is_scan_editor());

drop policy if exists scan_areas_read on scan_areas;
create policy scan_areas_read on scan_areas
  for select using (is_active or is_scan_editor());

drop policy if exists scan_areas_write on scan_areas;
create policy scan_areas_write on scan_areas
  for all using (is_scan_editor()) with check (is_scan_editor());

drop policy if exists scan_detections_read on scan_detections;
create policy scan_detections_read on scan_detections
  for select using (true);

drop policy if exists scan_detections_write on scan_detections;
create policy scan_detections_write on scan_detections
  for all using (is_scan_editor()) with check (is_scan_editor());

-- === Pilot seed: C-130J / External Power ===
-- Class labels match src/scan/recognition/guidedDetector.ts.

insert into scan_areas (aircraft, area, system, sort_order)
values ('C-130J', 'External Power', 'Electrical Power', 0)
on conflict do nothing;

with seed(class_label, name, descr, loc, label_type) as (
  values
    ('external_power_receptacle', 'External Power Receptacle',
     'Connection point used to provide external electrical power to the aircraft from an approved external power source.',
     'External power connection area on aircraft exterior.', 'interactive'),
    ('external_power_cable_plug', 'External Power Cable Plug',
     'Plug on the ground power cable that mates with the aircraft external power receptacle.',
     'External power connection area.', 'interactive'),
    ('contact_light', 'Contact Light',
     'Indicator that confirms a proper external power connection.',
     'Near the external power receptacle.', 'interactive'),
    ('external_power_available_indicator', 'External Power Available Indicator',
     'Indicates external power is available and within limits for application to the aircraft.',
     'Flight station / external power panel.', 'interactive'),
    ('aircraft_power_switch', 'Aircraft Power Switch',
     'Controls application of external power to the aircraft buses.',
     'Flight station power controls.', 'interactive')
)
insert into scan_components
  (aircraft, area, system, name, description, location, label_type,
   validation_status, is_published)
select 'C-130J', 'External Power', 'Electrical Power', s.name, s.descr, s.loc,
       s.label_type, 'approved', true
from seed s
on conflict do nothing;

insert into scan_detections (class_label, component_id, aircraft, area)
select s.class_label, c.id, 'C-130J', 'External Power'
from (values
    ('external_power_receptacle', 'External Power Receptacle'),
    ('external_power_cable_plug', 'External Power Cable Plug'),
    ('contact_light', 'Contact Light'),
    ('external_power_available_indicator', 'External Power Available Indicator'),
    ('aircraft_power_switch', 'Aircraft Power Switch')
  ) as s(class_label, name)
join scan_components c
  on c.name = s.name and c.aircraft = 'C-130J' and c.area = 'External Power'
on conflict do nothing;

-- Wire the external-power IMI/animation trainer to the components it covers.
-- Other components have no IMI, so their cards won't show the launch button.
update scan_components
set imi_links = array['https://ext-power-trainer.vercel.app/']
where aircraft = 'C-130J' and area = 'External Power'
  and name in ('External Power Receptacle', 'External Power Available Indicator');

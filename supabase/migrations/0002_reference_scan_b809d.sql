-- Reference-image scan mode + B809D generator-set pilot.
-- Adds a backdrop photo per area and hotspot coordinates per detection, then
-- seeds the B809D Power Cart control panel as a working reference-image pilot.
-- Apply via the Supabase SQL editor.

-- === Schema additions ===

alter table scan_areas
  add column if not exists reference_image_url text;

alter table scan_detections
  add column if not exists pos_x real,
  add column if not exists pos_y real,
  add column if not exists pos_w real,
  add column if not exists pos_h real;

-- === B809D pilot: area ===
-- "aircraft" column holds the equipment name for ground support equipment.
-- reference_image_url points at the panel photo placed in /public/scan/.

insert into scan_areas (aircraft, area, system, sort_order, reference_image_url)
values ('B809D Power Cart', 'Control Panel', 'Aircraft Power Application', 1,
        '/scan/b809d-panel.jpg')
on conflict do nothing;

update scan_areas
set reference_image_url = '/scan/b809d-panel.jpg'
where aircraft = 'B809D Power Cart' and area = 'Control Panel';

-- === B809D pilot: components ===
-- Names are read from the panel silkscreen. Descriptions are minimal/functional
-- and must be validated/expanded by an SME before operational use.

with seed(class_label, name, system, descr, cx, cy) as (
  values
    ('panel_lights',      'Panel Lights Switch',        'Panel',          'Turns the control-panel lighting on and off.',                 0.490, 0.160),
    ('ac_volts',          'AC Volts Meter',             'AC Meters',      'Displays generator AC output voltage.',                        0.262, 0.310),
    ('ac_amperes',        'AC Amperes Meter',           'AC Meters',      'Displays generator AC output current.',                        0.370, 0.310),
    ('hertz',             'Hertz Meter',                'AC Meters',      'Displays generator output frequency.',                         0.470, 0.310),
    ('dc_volts',          'DC Volts Meter',             'DC Meters',      'Displays generator DC output voltage.',                        0.590, 0.310),
    ('dc_amperes',        'DC Amperes Meter',           'DC Meters',      'Displays generator DC output current.',                        0.700, 0.520),
    ('phase_selector',    'Phase Selector',             'Output Control', 'Selects the phase shown on the AC meters.',                    0.270, 0.540),
    ('output_selector',   'Output Voltage Selector',    'Output Control', 'Selects the output voltage range.',                            0.360, 0.630),
    ('contactor_closed',  'Contactor Closed Indicator', 'Output Control', 'Green light indicating the output contactor is closed.',       0.480, 0.660),
    ('current_limit_adj', 'Current Limit Adjust',       'Output Control', 'Sets the output current limit.',                               0.770, 0.600),
    ('master_switch',     'Master Switch',              'Engine Control', 'Main power switch for the generator set.',                     0.270, 0.840),
    ('emergency_stop',    'Emergency Stop',             'Engine Control', 'Immediately shuts down the generator set.',                    0.740, 0.890)
)
insert into scan_components
  (aircraft, area, system, name, description, label_type, validation_status, is_published)
select 'B809D Power Cart', 'Control Panel', s.system, s.name, s.descr,
       'interactive', 'approved', true
from seed s
on conflict do nothing;

-- === B809D pilot: detections (hotspots) ===
-- Box is centered on (cx, cy) with a uniform size; tune later via admin tooling.

with seed(class_label, name, cx, cy) as (
  values
    ('panel_lights',      'Panel Lights Switch',        0.490, 0.160),
    ('ac_volts',          'AC Volts Meter',             0.262, 0.310),
    ('ac_amperes',        'AC Amperes Meter',           0.370, 0.310),
    ('hertz',             'Hertz Meter',                0.470, 0.310),
    ('dc_volts',          'DC Volts Meter',             0.590, 0.310),
    ('dc_amperes',        'DC Amperes Meter',           0.700, 0.520),
    ('phase_selector',    'Phase Selector',             0.270, 0.540),
    ('output_selector',   'Output Voltage Selector',    0.360, 0.630),
    ('contactor_closed',  'Contactor Closed Indicator', 0.480, 0.660),
    ('current_limit_adj', 'Current Limit Adjust',       0.770, 0.600),
    ('master_switch',     'Master Switch',              0.270, 0.840),
    ('emergency_stop',    'Emergency Stop',             0.740, 0.890)
)
insert into scan_detections (class_label, component_id, aircraft, area, pos_x, pos_y, pos_w, pos_h)
select s.class_label, c.id, 'B809D Power Cart', 'Control Panel',
       s.cx - 0.035, s.cy - 0.045, 0.07, 0.09
from seed s
join scan_components c
  on c.name = s.name and c.aircraft = 'B809D Power Cart' and c.area = 'Control Panel'
on conflict do nothing;

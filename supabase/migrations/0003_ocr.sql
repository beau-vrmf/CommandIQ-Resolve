-- OCR recognition: part numbers + placard match terms.
-- Adds columns to scan_components and seeds ocr_terms on the B809D controls with
-- the wording printed on the real panel, so an OCR capture matches them.
-- Apply via the Supabase SQL editor.

-- === Schema ===

alter table scan_components
  add column if not exists part_number text,
  add column if not exists ocr_terms text[];

-- === B809D placard terms ===
-- Terms are matched case-insensitively after stripping punctuation. Include the
-- exact wording on the panel (and common variants) so OCR lands a match.

update scan_components set ocr_terms = array['AC METERS','AC VOLTS']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'AC Volts Meter';
update scan_components set ocr_terms = array['AC AMPERES','AC AMPS']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'AC Amperes Meter';
update scan_components set ocr_terms = array['HERTZ','FREQUENCY']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'Hertz Meter';
update scan_components set ocr_terms = array['DC METERS','DC VOLTS']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'DC Volts Meter';
update scan_components set ocr_terms = array['DC AMPERES','DC AMPS']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'DC Amperes Meter';
update scan_components set ocr_terms = array['PHASE SELECTOR','PHASE']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'Phase Selector';
update scan_components set ocr_terms = array['OUTPUT SELECTOR','OUTPUT VOLTAGE']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'Output Voltage Selector';
update scan_components set ocr_terms = array['CONTACTOR CLOSED','CONTACTOR']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'Contactor Closed Indicator';
update scan_components set ocr_terms = array['CURRENT LIMIT ADJUST','CURRENT LIMIT']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'Current Limit Adjust';
update scan_components set ocr_terms = array['MASTER']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'Master Switch';
update scan_components set ocr_terms = array['EMERGENCY STOP','EMERGENCY']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'Emergency Stop';
update scan_components set ocr_terms = array['PANEL LIGHTS']
  where aircraft = 'B809D Power Cart' and area = 'Control Panel' and name = 'Panel Lights Switch';

Place the B809D control-panel reference photo here as:

    b809d-panel.jpg

The reference-image scan mode loads it from /scan/b809d-panel.jpg (set in
scan_areas.reference_image_url by supabase/migrations/0002_reference_scan_b809d.sql).

Hotspot coordinates in that migration are normalized (0..1) to the image, so they
line up regardless of the photo's pixel dimensions. If the photo is cropped
differently from the original, fine-tune the pos_x/pos_y values for each control.

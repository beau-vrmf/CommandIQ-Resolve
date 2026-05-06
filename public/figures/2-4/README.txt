TO source page images for Figure 2-4 (Propeller Assembly Malfunction).
(Project hosted on Vercel under the moth-and-flame-vr Pro team.)

Naming convention: sht-<sheetNumber>.png  (or .jpg / .jpeg / .webp)

Currently expected files (one per authored sheet):
  sht-15.png   — Sheet 15  (blocks 47, 49, 50)   fault 6110004 entry
  sht-17.png   — Sheet 17  (blocks 52-60)        fault 6110005 entry
  sht-19.png   — Sheet 19  (blocks 61-64)        continuation from block 55
  sht-21.png   — Sheet 21  (blocks 65-70)        continuation from block 63

These are bundled directly into the Vercel deploy and precached by the
service worker for offline use. If a file is missing, the "View TO source"
button will still appear on the corresponding block but the lightbox will
show a friendly placeholder instead of a broken image.

To gate access in the future (private bucket + signed URLs), update
src/data/fi-tree.ts so blocks point to the bucket URLs instead of /figures/...,
and remove these files from the public deploy.

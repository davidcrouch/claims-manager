-- Populate BOM components for all assemblies that currently have zero components.
-- Uses catalog_items.code to resolve UUIDs so the script is portable across envs.
-- Run: docker exec pgsql psql -U more0ai -d claims_manager -f /data/seed-assembly-bom.sql
-- (mount the file first, or pipe via stdin)

BEGIN;

-- Helper: resolve assembly_id and component_id by code within the single tenant.
-- All INSERTs use a subselect pattern:
--   (SELECT id FROM catalog_items WHERE code = '...' AND tenant_id = t.id)

WITH t AS (SELECT id FROM organizations LIMIT 1)

INSERT INTO catalog_assembly_components (tenant_id, assembly_id, component_id, quantity, waste_factor, sort_index, notes)
SELECT t.id,
       (SELECT id FROM catalog_items WHERE code = asm_code AND tenant_id = t.id),
       (SELECT id FROM catalog_items WHERE code = comp_code AND tenant_id = t.id),
       qty::numeric(14,4),
       wf::numeric(8,4),
       si,
       note
FROM t, (VALUES
  -- ── ASM-WET-BATH-REL — Bathroom relining ──────────────────────────────
  ('ASM-WET-BATH-REL', 'LAB-GEN-02',           8,  1,      0, 'Strip out wet area'),
  ('ASM-WET-BATH-REL', 'WP-MEMBRANE',          1,  1.05,   1, 'Waterproof membrane'),
  ('ASM-WET-BATH-REL', 'MAT-PLAS-GYP-MR-03',  6,  1.1,    2, 'Moisture resistant board'),
  ('ASM-WET-BATH-REL', 'LAB-PLS-01',           8,  1,      3, 'Fix plasterboard'),
  ('ASM-WET-BATH-REL', 'LAB-PLS-02',           4,  1,      4, 'Set plaster joints'),
  ('ASM-WET-BATH-REL', 'MAT-GENE-TILE-CER-09', 12, 1.1,   5, 'Floor tiles'),
  ('ASM-WET-BATH-REL', 'MAT-GENE-TILE-POR-10', 8,  1.1,   6, 'Wall tiles'),
  ('ASM-WET-BATH-REL', 'LAB-GEN-08',           6,  1,      7, 'Lay tiles'),
  ('ASM-WET-BATH-REL', 'LAB-PLU-09',           4,  1,      8, 'Plumbing fit-off'),
  ('ASM-WET-BATH-REL', 'LAB-GEN-07',           4,  1,      9, 'Paint coats'),

  -- ── ASM-WET-SHOWER-REL — Shower recess reline ────────────────────────
  ('ASM-WET-SHOWER-REL', 'LAB-GEN-02',           4,  1,      0, 'Strip out wet area'),
  ('ASM-WET-SHOWER-REL', 'WP-MEMBRANE',          1,  1.05,   1, 'Waterproof membrane'),
  ('ASM-WET-SHOWER-REL', 'MAT-PLAS-GYP-MR-03',  3,  1.1,    2, 'Moisture resistant board'),
  ('ASM-WET-SHOWER-REL', 'LAB-PLS-01',           4,  1,      3, 'Fix plasterboard'),
  ('ASM-WET-SHOWER-REL', 'MAT-GENE-TILE-POR-10', 6,  1.1,   4, 'Wall tiles'),
  ('ASM-WET-SHOWER-REL', 'LAB-GEN-08',           4,  1,      5, 'Lay tiles'),
  ('ASM-WET-SHOWER-REL', 'MAT-PLUM-SHOWER-SCREEN-06', 1, 1,  6, 'Shower screen'),
  ('ASM-WET-SHOWER-REL', 'LAB-PLU-07',           2,  1,      7, 'Install shower'),

  -- ── ASM-WET-LAUNDRY — Laundry restoration ────────────────────────────
  ('ASM-WET-LAUNDRY', 'LAB-GEN-02',           3,  1,      0, 'Strip out wet area'),
  ('ASM-WET-LAUNDRY', 'WP-MEMBRANE',          1,  1.05,   1, 'Waterproof membrane'),
  ('ASM-WET-LAUNDRY', 'MAT-PLAS-GYP-MR-03',  4,  1.1,    2, 'Moisture resistant board'),
  ('ASM-WET-LAUNDRY', 'LAB-PLS-01',           4,  1,      3, 'Fix plasterboard'),
  ('ASM-WET-LAUNDRY', 'LAB-PLU-09',           3,  1,      4, 'Plumbing fit-off'),
  ('ASM-WET-LAUNDRY', 'LAB-GEN-07',           3,  1,      5, 'Paint coats'),

  -- ── ASM-KIT-BENCH-REP — Kitchen bench replace ────────────────────────
  ('ASM-KIT-BENCH-REP', 'LAB-GEN-03',               2,  1,      0, 'Demo strip out'),
  ('ASM-KIT-BENCH-REP', 'MAT-CARP-BENCH-TOP-17',    3,  1.05,   1, 'Laminate benchtop'),
  ('ASM-KIT-BENCH-REP', 'LAB-CAR-07',               4,  1,      2, 'Install cabinetry'),
  ('ASM-KIT-BENCH-REP', 'LAB-PLU-09',               2,  1,      3, 'Plumbing fit-off'),
  ('ASM-KIT-BENCH-REP', 'MAT-GENE-TILE-POR-10',     4,  1.1,    4, 'Splashback tiles'),
  ('ASM-KIT-BENCH-REP', 'LAB-GEN-08',               2,  1,      5, 'Lay tiles'),

  -- ── ASM-KIT-CAB-REF — Kitchen cabinet refit ──────────────────────────
  ('ASM-KIT-CAB-REF', 'LAB-GEN-03',               3,  1,      0, 'Demo strip out'),
  ('ASM-KIT-CAB-REF', 'MAT-CARP-CAB-HINGE-18',   12, 1,      1, 'Soft close hinges'),
  ('ASM-KIT-CAB-REF', 'MAT-CARP-DRAW-RUNNER-19', 6,  1,      2, 'Drawer runners'),
  ('ASM-KIT-CAB-REF', 'MAT-CARP-CAB-SHELF-15',   8,  1,      3, 'Adjustable shelves'),
  ('ASM-KIT-CAB-REF', 'MAT-CARP-KICK-BOARD-16',  3,  1,      4, 'Kitchen kickboard'),
  ('ASM-KIT-CAB-REF', 'LAB-CAR-07',              8,  1,      5, 'Install cabinetry'),
  ('ASM-KIT-CAB-REF', 'LAB-PLU-09',              2,  1,      6, 'Plumbing fit-off'),

  -- ── ASM-KIT-SPLASH — Kitchen splashback ──────────────────────────────
  ('ASM-KIT-SPLASH', 'MAT-GENE-TILE-POR-10',  6,  1.1,    0, 'Porcelain wall tiles'),
  ('ASM-KIT-SPLASH', 'MAT-GENE-TILE-ADH-11',  2,  1,      1, 'Tile adhesive'),
  ('ASM-KIT-SPLASH', 'MAT-GENE-GROUT-BAG-12', 1,  1,      2, 'Grout'),
  ('ASM-KIT-SPLASH', 'LAB-GEN-08',            3,  1,      3, 'Lay tiles'),

  -- ── ASM-FLR-CARP-BED — Bedroom carpet replace ────────────────────────
  ('ASM-FLR-CARP-BED', 'MAT-GENE-CARPET-14',   14, 1.1,    0, 'Carpet supply'),
  ('ASM-FLR-CARP-BED', 'MAT-GENE-UNDERLAY-15', 14, 1.05,   1, 'Carpet underlay'),
  ('ASM-FLR-CARP-BED', 'LAB-GEN-09',           3,  1,      2, 'Lay carpet'),

  -- ── ASM-FLR-CARP-LIV — Living carpet replace ─────────────────────────
  ('ASM-FLR-CARP-LIV', 'MAT-GENE-CARPET-14',   24, 1.1,    0, 'Carpet supply'),
  ('ASM-FLR-CARP-LIV', 'MAT-GENE-UNDERLAY-15', 24, 1.05,   1, 'Carpet underlay'),
  ('ASM-FLR-CARP-LIV', 'LAB-GEN-09',           5,  1,      2, 'Lay carpet'),

  -- ── ASM-FLR-VINYL-WET — Wet area vinyl ───────────────────────────────
  ('ASM-FLR-VINYL-WET', 'MAT-GENE-VINYL-PLK-13', 10, 1.1,   0, 'Vinyl plank'),
  ('ASM-FLR-VINYL-WET', 'LAB-GEN-08',            4,  1,      1, 'Lay flooring'),
  ('ASM-FLR-VINYL-WET', 'MAT-CARP-PLY-17-05',    3,  1.05,   2, 'Flooring ply substrate'),

  -- ── ASM-FLR-TILE-BATH — Bathroom floor tiles ─────────────────────────
  ('ASM-FLR-TILE-BATH', 'MAT-GENE-TILE-CER-09',  8,  1.1,    0, 'Ceramic floor tiles'),
  ('ASM-FLR-TILE-BATH', 'MAT-GENE-TILE-ADH-11',  3,  1,      1, 'Tile adhesive'),
  ('ASM-FLR-TILE-BATH', 'MAT-GENE-GROUT-BAG-12', 2,  1,      2, 'Grout'),
  ('ASM-FLR-TILE-BATH', 'WP-MEMBRANE',            1,  1.05,   3, 'Waterproof membrane'),
  ('ASM-FLR-TILE-BATH', 'LAB-GEN-08',             4,  1,      4, 'Lay tiles'),

  -- ── ASM-CEIL-SET-DOWN — Ceiling set down ──────────────────────────────
  ('ASM-CEIL-SET-DOWN', 'LAB-GEN-03',                3,  1,      0, 'Demo strip out'),
  ('ASM-CEIL-SET-DOWN', 'MAT-PLAS-TIMBER-BAT-15',   10, 1.1,    1, 'Ceiling battens'),
  ('ASM-CEIL-SET-DOWN', 'MAT-PLAS-GYP-10-01',       8,  1.1,    2, 'Plasterboard sheets'),
  ('ASM-CEIL-SET-DOWN', 'MAT-PLAS-INSULATION-BAT-09', 8, 1.05,  3, 'Insulation batts'),
  ('ASM-CEIL-SET-DOWN', 'LAB-PLS-05',               6,  1,      4, 'Ceiling set down labour'),
  ('ASM-CEIL-SET-DOWN', 'LAB-PLS-02',               4,  1,      5, 'Set plaster joints'),
  ('ASM-CEIL-SET-DOWN', 'LAB-GEN-07',               4,  1,      6, 'Paint coats'),

  -- ── ASM-WALL-LINING-REP — Wall lining repair ─────────────────────────
  ('ASM-WALL-LINING-REP', 'LAB-GEN-03',            2,  1,      0, 'Demo strip out'),
  ('ASM-WALL-LINING-REP', 'MAT-PLAS-GYP-10-01',   6,  1.1,    1, 'Plasterboard sheets'),
  ('ASM-WALL-LINING-REP', 'MAT-PLAS-JOINT-CMP-07', 2, 1,      2, 'Joint compound'),
  ('ASM-WALL-LINING-REP', 'MAT-PLAS-PAPER-TAPE-08', 2, 1,     3, 'Paper tape'),
  ('ASM-WALL-LINING-REP', 'LAB-PLS-01',            6,  1,      4, 'Fix plasterboard'),
  ('ASM-WALL-LINING-REP', 'LAB-PLS-02',            4,  1,      5, 'Set plaster joints'),
  ('ASM-WALL-LINING-REP', 'LAB-PLS-03',            2,  1,      6, 'Sand finish'),
  ('ASM-WALL-LINING-REP', 'LAB-GEN-07',            4,  1,      7, 'Paint coats'),

  -- ── ASM-FIRE-SMOKE-ROOM — Smoke damage room ──────────────────────────
  ('ASM-FIRE-SMOKE-ROOM', 'LAB-GEN-05',              3,  1,      0, 'Final clean'),
  ('ASM-FIRE-SMOKE-ROOM', 'MAT-GENE-CLEAN-SOL-32',   4,  1,      1, 'Cleaning solution'),
  ('ASM-FIRE-SMOKE-ROOM', 'MAT-GENE-PAINT-PRIM-03',  8,  1.1,    2, 'Primer sealer'),
  ('ASM-FIRE-SMOKE-ROOM', 'MAT-GENE-PAINT-INT-01',   12, 1.1,    3, 'Interior paint'),
  ('ASM-FIRE-SMOKE-ROOM', 'LAB-GEN-06',              4,  1,      4, 'Prepare for painting'),
  ('ASM-FIRE-SMOKE-ROOM', 'LAB-GEN-07',              6,  1,      5, 'Apply paint coats'),

  -- ── ASM-FIRE-KITCH — Kitchen fire damage ──────────────────────────────
  ('ASM-FIRE-KITCH', 'LAB-GEN-03',              8,  1,      0, 'Demo strip out'),
  ('ASM-FIRE-KITCH', 'LAB-GEN-04',              4,  1,      1, 'Rubbish removal'),
  ('ASM-FIRE-KITCH', 'MAT-CARP-TIMBER-90-01',   20, 1.1,    2, 'Framing timber'),
  ('ASM-FIRE-KITCH', 'LAB-CAR-01',              8,  1,      3, 'Frame internal wall'),
  ('ASM-FIRE-KITCH', 'MAT-PLAS-GYP-10-01',      10, 1.1,    4, 'Plasterboard'),
  ('ASM-FIRE-KITCH', 'LAB-PLS-01',              6,  1,      5, 'Fix plasterboard'),
  ('ASM-FIRE-KITCH', 'LAB-PLS-02',              4,  1,      6, 'Set plaster joints'),
  ('ASM-FIRE-KITCH', 'LAB-CAR-07',              8,  1,      7, 'Install cabinetry'),
  ('ASM-FIRE-KITCH', 'LAB-PLU-09',              4,  1,      8, 'Plumbing fit-off'),
  ('ASM-FIRE-KITCH', 'LAB-ELE-01',              4,  1,      9, 'Electrical install'),
  ('ASM-FIRE-KITCH', 'LAB-GEN-07',              6,  1,     10, 'Paint coats'),

  -- ── ASM-FLOOD-ROOM — Flood damage room ───────────────────────────────
  ('ASM-FLOOD-ROOM', 'LAB-GEN-03',               4,  1,      0, 'Demo strip out'),
  ('ASM-FLOOD-ROOM', 'EQ-DEHUM',                 5,  1,      1, 'Dehumidifier hire'),
  ('ASM-FLOOD-ROOM', 'EQ-FAN',                   5,  1,      2, 'Axial fan hire'),
  ('ASM-FLOOD-ROOM', 'MAT-PLAS-GYP-10-01',       6,  1.1,    3, 'Plasterboard'),
  ('ASM-FLOOD-ROOM', 'LAB-PLS-01',               6,  1,      4, 'Fix plasterboard'),
  ('ASM-FLOOD-ROOM', 'LAB-PLS-02',               4,  1,      5, 'Set plaster joints'),
  ('ASM-FLOOD-ROOM', 'LAB-GEN-06',               3,  1,      6, 'Paint prep'),
  ('ASM-FLOOD-ROOM', 'LAB-GEN-07',               4,  1,      7, 'Paint coats'),

  -- ── ASM-FLOOD-WHOLE-L1 — Ground floor flood ──────────────────────────
  ('ASM-FLOOD-WHOLE-L1', 'EQ-PUMP-SUB',             3,  1,      0, 'Pump hire'),
  ('ASM-FLOOD-WHOLE-L1', 'EQ-DEHUM',                14, 1,      1, 'Dehumidifier hire'),
  ('ASM-FLOOD-WHOLE-L1', 'EQ-FAN',                  14, 1,      2, 'Axial fan hire'),
  ('ASM-FLOOD-WHOLE-L1', 'LAB-GEN-03',              16, 1,      3, 'Demo strip out'),
  ('ASM-FLOOD-WHOLE-L1', 'LAB-GEN-04',              8,  1,      4, 'Rubbish removal'),
  ('ASM-FLOOD-WHOLE-L1', 'MAT-PLAS-GYP-10-01',      24, 1.1,    5, 'Plasterboard'),
  ('ASM-FLOOD-WHOLE-L1', 'LAB-PLS-01',              16, 1,      6, 'Fix plasterboard'),
  ('ASM-FLOOD-WHOLE-L1', 'LAB-PLS-02',              10, 1,      7, 'Set plaster joints'),
  ('ASM-FLOOD-WHOLE-L1', 'LAB-GEN-06',              8,  1,      8, 'Paint prep'),
  ('ASM-FLOOD-WHOLE-L1', 'LAB-GEN-07',              16, 1,      9, 'Paint coats'),
  ('ASM-FLOOD-WHOLE-L1', 'MAT-GENE-CARPET-14',      40, 1.1,   10, 'Carpet supply'),
  ('ASM-FLOOD-WHOLE-L1', 'LAB-GEN-09',              8,  1,     11, 'Lay carpet'),

  -- ── ASM-MOULD-ROOM — Mould remediation room ──────────────────────────
  ('ASM-MOULD-ROOM', 'LAB-GEN-14',              4,  1,      0, 'Build containment'),
  ('ASM-MOULD-ROOM', 'EQ-AIR-SCRUB',            3,  1,      1, 'Air scrubber hire'),
  ('ASM-MOULD-ROOM', 'EQ-HEPA-VAC',             2,  1,      2, 'HEPA vacuum hire'),
  ('ASM-MOULD-ROOM', 'MAT-GENE-MOULD-TRT-33',  4,  1,      3, 'Mould treatment'),
  ('ASM-MOULD-ROOM', 'LAB-GEN-13',              6,  1,      4, 'Mould clean'),
  ('ASM-MOULD-ROOM', 'VND-MOULD-CERT',          1,  1,      5, 'Clearance test'),

  -- ── ASM-MOULD-WET — Wet area mould treat ─────────────────────────────
  ('ASM-MOULD-WET', 'LAB-GEN-14',              3,  1,      0, 'Build containment'),
  ('ASM-MOULD-WET', 'EQ-AIR-SCRUB',            3,  1,      1, 'Air scrubber hire'),
  ('ASM-MOULD-WET', 'MAT-GENE-MOULD-TRT-33',  3,  1,      2, 'Mould treatment'),
  ('ASM-MOULD-WET', 'LAB-GEN-13',              4,  1,      3, 'Mould clean'),
  ('ASM-MOULD-WET', 'WP-MEMBRANE',             1,  1.05,   4, 'Waterproof membrane'),
  ('ASM-MOULD-WET', 'VND-MOULD-CERT',          1,  1,      5, 'Clearance test'),

  -- ── ASM-STORM-ROOF-PATCH — Storm roof patch ──────────────────────────
  ('ASM-STORM-ROOF-PATCH', 'MAT-GENE-ROOF-TILE-16',  12, 1.1,   0, 'Roof tiles'),
  ('ASM-STORM-ROOF-PATCH', 'MAT-GENE-ROOF-BED-17',   2,  1,     1, 'Bedding compound'),
  ('ASM-STORM-ROOF-PATCH', 'MAT-GENE-ROOF-PTG-18',   2,  1,     2, 'Pointing compound'),
  ('ASM-STORM-ROOF-PATCH', 'EQ-SCAFF-1',              2,  1,     3, 'Scaffold hire'),
  ('ASM-STORM-ROOF-PATCH', 'EQ-ROOF-HAR',             2,  1,     4, 'Roof harness'),
  ('ASM-STORM-ROOF-PATCH', 'LAB-GEN-10',              6,  1,     5, 'Roof repair labour'),

  -- ── ASM-STORM-FENCE — Storm fence rebuild ─────────────────────────────
  ('ASM-STORM-FENCE', 'MAT-GENE-FENCE-PAL-23', 10, 1.1,    0, 'Paling fence panels'),
  ('ASM-STORM-FENCE', 'MAT-CARP-TIMBER-90-01', 6,  1.1,    1, 'Fence posts'),
  ('ASM-STORM-FENCE', 'LAB-GEN-11',            8,  1,      2, 'Fence repair labour'),
  ('ASM-STORM-FENCE', 'MAT-GENE-CONCRETE-M3-25', 0.5, 1,  3, 'Concrete for posts'),

  -- ── ASM-STORM-GUTTER — Gutter replacement ─────────────────────────────
  ('ASM-STORM-GUTTER', 'MAT-GENE-GUTTER-QUAD-19', 12, 1.05,  0, 'Quad gutter'),
  ('ASM-STORM-GUTTER', 'MAT-GENE-DOWNPIPE-20',     4,  1,     1, 'Downpipe sections'),
  ('ASM-STORM-GUTTER', 'MAT-GENE-FASCIA-21',        6,  1.05,  2, 'Fascia board'),
  ('ASM-STORM-GUTTER', 'EQ-SCAFF-1',                2,  1,     3, 'Scaffold hire'),
  ('ASM-STORM-GUTTER', 'LAB-GEN-10',                4,  1,     4, 'Roof repair labour'),

  -- ── ASM-ELE-REWIRE-CCT — Circuit rewire ───────────────────────────────
  ('ASM-ELE-REWIRE-CCT', 'MAT-ELEC-CABLE-2.5-07', 20, 1.1,   0, 'TPS cable'),
  ('ASM-ELE-REWIRE-CCT', 'MAT-ELEC-CB-09',         1,  1,     1, 'Circuit breaker'),
  ('ASM-ELE-REWIRE-CCT', 'MAT-ELEC-GPO-01',        4,  1,     2, 'Power outlets'),
  ('ASM-ELE-REWIRE-CCT', 'LAB-ELE-07',             4,  1,     3, 'Cable pull labour'),
  ('ASM-ELE-REWIRE-CCT', 'LAB-ELE-01',             4,  1,     4, 'GPO install labour'),
  ('ASM-ELE-REWIRE-CCT', 'LAB-ELE-10',             1,  1,     5, 'Compliance test'),

  -- ── ASM-ELE-BOARD-UPG — Switchboard upgrade ──────────────────────────
  ('ASM-ELE-BOARD-UPG', 'MAT-ELEC-METER-BOX-10',  1,  1,     0, 'Meter box'),
  ('ASM-ELE-BOARD-UPG', 'MAT-ELEC-RCD-06',        3,  1,     1, 'RCD safety switches'),
  ('ASM-ELE-BOARD-UPG', 'MAT-ELEC-CB-09',         8,  1,     2, 'Circuit breakers'),
  ('ASM-ELE-BOARD-UPG', 'LAB-ELE-04',             6,  1,     3, 'Switchboard labour'),
  ('ASM-ELE-BOARD-UPG', 'LAB-ELE-10',             2,  1,     4, 'Compliance test'),

  -- ── ASM-ELE-SMOKE-UPG — Smoke alarm upgrade ──────────────────────────
  ('ASM-ELE-SMOKE-UPG', 'MAT-ELEC-SMK-ALARM-05',  6,  1,     0, 'Smoke alarms'),
  ('ASM-ELE-SMOKE-UPG', 'MAT-ELEC-CABLE-1.5-08',  15, 1.1,   1, 'Cable'),
  ('ASM-ELE-SMOKE-UPG', 'LAB-ELE-06',             2,  1,     2, 'Test smoke alarms'),
  ('ASM-ELE-SMOKE-UPG', 'LAB-ELE-07',             2,  1,     3, 'Cable pull labour'),

  -- ── ASM-PLU-HWS-REP — Hot water replace ──────────────────────────────
  ('ASM-PLU-HWS-REP', 'MAT-PLUM-HWS-UNIT-16',   1,  1,     0, 'Hot water unit'),
  ('ASM-PLU-HWS-REP', 'MAT-PLUM-PTR-VALVE-08',  1,  1,     1, 'PTR valve'),
  ('ASM-PLU-HWS-REP', 'MAT-PLUM-FLEX-HOSE-07',  2,  1,     2, 'Flex hoses'),
  ('ASM-PLU-HWS-REP', 'LAB-PLU-06',             4,  1,     3, 'Install HWS labour'),
  ('ASM-PLU-HWS-REP', 'LAB-ELE-09',             2,  1,     4, 'Reconnect HWS electrical'),
  ('ASM-PLU-HWS-REP', 'OTH-PLM-PERM',           1,  1,     5, 'Plumbing permit'),

  -- ── ASM-PLU-DRAIN-REP — Underground drain repair ─────────────────────
  ('ASM-PLU-DRAIN-REP', 'MAT-PLUM-PIPE-PVC-100-12', 6, 1.1,   0, '100mm sewer pipe'),
  ('ASM-PLU-DRAIN-REP', 'LAB-PLU-08',               6,  1,     1, 'Plumbing rough-in'),
  ('ASM-PLU-DRAIN-REP', 'LAB-PLU-10',               2,  1,     2, 'Drain camera inspect'),
  ('ASM-PLU-DRAIN-REP', 'EQ-EXC-MINI',              1,  1,     3, 'Mini excavator hire'),
  ('ASM-PLU-DRAIN-REP', 'MAT-GENE-CONCRETE-M3-25',  0.5, 1,   4, 'Concrete backfill'),
  ('ASM-PLU-DRAIN-REP', 'OTH-PLM-PERM',             1,  1,     5, 'Plumbing permit'),

  -- ── ASM-PLU-BURST-PIPE — Burst pipe make safe ────────────────────────
  ('ASM-PLU-BURST-PIPE', 'LAB-PLU-05',               3,  1,     0, 'Repair burst pipe'),
  ('ASM-PLU-BURST-PIPE', 'MAT-PLUM-PIPE-COP-15-09',  2,  1.1,   1, '15mm copper pipe'),
  ('ASM-PLU-BURST-PIPE', 'MAT-PLUM-FLEX-HOSE-07',    2,  1,     2, 'Flex hoses'),
  ('ASM-PLU-BURST-PIPE', 'LAB-GEN-01',               2,  1,     3, 'Make safe attendance'),

  -- ── ASM-CAR-INT-DOOR — Internal door replace ─────────────────────────
  ('ASM-CAR-INT-DOOR', 'MAT-CARP-DOOR-BED-10',     1,  1,     0, 'Hollow core door'),
  ('ASM-CAR-INT-DOOR', 'MAT-CARP-DOOR-JAMB-09',    1,  1,     1, 'Door jamb set'),
  ('ASM-CAR-INT-DOOR', 'MAT-CARP-HINGE-PAIR-14',   2,  1,     2, 'Door hinges'),
  ('ASM-CAR-INT-DOOR', 'MAT-CARP-HET-PASS-13',     1,  1,     3, 'Privacy lockset'),
  ('ASM-CAR-INT-DOOR', 'MAT-CARP-ARCHITRAVE-08',    5,  1.1,   4, 'Architrave'),
  ('ASM-CAR-INT-DOOR', 'LAB-CAR-02',               3,  1,     5, 'Hang door labour'),

  -- ── ASM-CAR-WIN-LINING — Window lining replace ───────────────────────
  ('ASM-CAR-WIN-LINING', 'MAT-CARP-TIMBER-70-02',   4,  1.1,   0, 'Battens'),
  ('ASM-CAR-WIN-LINING', 'MAT-CARP-ARCHITRAVE-08',  4,  1.1,   1, 'Architrave'),
  ('ASM-CAR-WIN-LINING', 'LAB-CAR-09',              3,  1,     2, 'Install window lining'),
  ('ASM-CAR-WIN-LINING', 'LAB-GEN-07',              2,  1,     3, 'Paint coats'),

  -- ── ASM-CAR-FLOOR-JOIST — Floor joist repair ─────────────────────────
  ('ASM-CAR-FLOOR-JOIST', 'MAT-CARP-TIMBER-140-03',  8,  1.1,   0, 'Floor joists'),
  ('ASM-CAR-FLOOR-JOIST', 'MAT-CARP-PLY-17-05',      4,  1.1,   1, 'Flooring ply'),
  ('ASM-CAR-FLOOR-JOIST', 'LAB-CAR-05',              8,  1,     2, 'Repair floor structure'),
  ('ASM-CAR-FLOOR-JOIST', 'LAB-GEN-03',              2,  1,     3, 'Demo strip out'),

  -- ── ASM-CAR-DECK-SEC — Deck board replace ────────────────────────────
  ('ASM-CAR-DECK-SEC', 'MAT-CARP-DECK-BRD-20',  12, 1.1,    0, 'Decking boards'),
  ('ASM-CAR-DECK-SEC', 'LAB-CAR-06',            6,  1,      1, 'Repair decking labour'),
  ('ASM-CAR-DECK-SEC', 'MAT-CARP-TIMBER-90-01', 4,  1.1,    2, 'Framing timber bearers'),

  -- ── ASM-EXT-DRIVE-PATCH — Driveway patch ─────────────────────────────
  ('ASM-EXT-DRIVE-PATCH', 'MAT-GENE-CONCRETE-M3-25', 1,  1,     0, 'Concrete supply'),
  ('ASM-EXT-DRIVE-PATCH', 'MAT-GENE-REO-MESH-26',    2,  1,     1, 'Reinforcing mesh'),
  ('ASM-EXT-DRIVE-PATCH', 'LAB-GEN-12',              6,  1,     2, 'Patch concrete labour'),
  ('ASM-EXT-DRIVE-PATCH', 'EQ-CONCRETE-CUT',          1,  1,     3, 'Concrete cutter hire'),

  -- ── ASM-EXT-PATH-REP — Path reinstatement ────────────────────────────
  ('ASM-EXT-PATH-REP', 'MAT-GENE-CONCRETE-M3-25', 0.5, 1,    0, 'Concrete supply'),
  ('ASM-EXT-PATH-REP', 'MAT-GENE-REO-MESH-26',    1,   1,    1, 'Reinforcing mesh'),
  ('ASM-EXT-PATH-REP', 'LAB-GEN-12',              4,   1,    2, 'Patch concrete labour'),

  -- ── ASM-EXT-LANDSCAPE — Landscape restoration ────────────────────────
  ('ASM-EXT-LANDSCAPE', 'LAB-GEN-12',     6,  1,     0, 'Concrete/paving repair'),
  ('ASM-EXT-LANDSCAPE', 'LAB-GEN-04',     4,  1,     1, 'Rubbish removal'),
  ('ASM-EXT-LANDSCAPE', 'EQ-EXC-MINI',    1,  1,     2, 'Mini excavator hire'),

  -- ── ASM-MAKE-SAFE — Emergency make safe ──────────────────────────────
  ('ASM-MAKE-SAFE', 'LAB-GEN-01',            4,  1,     0, 'Make safe attendance'),
  ('ASM-MAKE-SAFE', 'OTH-TARP-ROOF',         1,  1,     1, 'Emergency tarp'),
  ('ASM-MAKE-SAFE', 'OTH-SECURITY-BOARD',    1,  1,     2, 'Board up'),
  ('ASM-MAKE-SAFE', 'OTH-PHOTO-DOC',         1,  1,     3, 'Photo documentation'),

  -- ── ASM-TEMP-FENCE — Temp fence package ──────────────────────────────
  ('ASM-TEMP-FENCE', 'MAT-GENE-TEMP-FENCE-40', 8,  1,     0, 'Temp fence panels'),
  ('ASM-TEMP-FENCE', 'MAT-GENE-SITE-SIGN-42',  1,  1,     1, 'Safety signage'),
  ('ASM-TEMP-FENCE', 'LAB-GEN-15',             2,  1,     2, 'Site supervision'),

  -- ── ASM-CONTAINMENT — Containment setup ──────────────────────────────
  ('ASM-CONTAINMENT', 'MAT-GENE-POLY-SHEET-38',  20, 1.1,   0, 'Poly sheet'),
  ('ASM-CONTAINMENT', 'MAT-GENE-TAPE-ZONE-39',   4,  1,     1, 'Contamination tape'),
  ('ASM-CONTAINMENT', 'EQ-AIR-SCRUB',            3,  1,     2, 'Air scrubber hire'),
  ('ASM-CONTAINMENT', 'LAB-GEN-14',              4,  1,     3, 'Build containment labour'),

  -- ── ASM-PAINT-INT-ROOM — Interior room repaint ───────────────────────
  ('ASM-PAINT-INT-ROOM', 'MAT-GENE-PAINT-INT-01',   8,  1.1,   0, 'Interior paint'),
  ('ASM-PAINT-INT-ROOM', 'MAT-GENE-PAINT-PRIM-03',  4,  1.1,   1, 'Primer sealer'),
  ('ASM-PAINT-INT-ROOM', 'MAT-GENE-FILL-GAP-05',    2,  1,     2, 'Gap filler'),
  ('ASM-PAINT-INT-ROOM', 'MAT-GENE-SAND-PAPER-06',  1,  1,     3, 'Sandpaper'),
  ('ASM-PAINT-INT-ROOM', 'MAT-GENE-DROP-SHEET-07',  2,  1,     4, 'Drop sheets'),
  ('ASM-PAINT-INT-ROOM', 'LAB-GEN-06',              3,  1,     5, 'Paint prep'),
  ('ASM-PAINT-INT-ROOM', 'LAB-GEN-07',              4,  1,     6, 'Paint coats'),

  -- ── ASM-PAINT-INT-HOUSE — Whole house repaint ────────────────────────
  ('ASM-PAINT-INT-HOUSE', 'MAT-GENE-PAINT-INT-01',   40, 1.1,   0, 'Interior paint'),
  ('ASM-PAINT-INT-HOUSE', 'MAT-GENE-PAINT-PRIM-03',  20, 1.1,   1, 'Primer sealer'),
  ('ASM-PAINT-INT-HOUSE', 'MAT-GENE-PAINT-UNDR-04',  10, 1.1,   2, 'Undercoat'),
  ('ASM-PAINT-INT-HOUSE', 'MAT-GENE-FILL-GAP-05',    8,  1,     3, 'Gap filler'),
  ('ASM-PAINT-INT-HOUSE', 'MAT-GENE-SAND-PAPER-06',  4,  1,     4, 'Sandpaper'),
  ('ASM-PAINT-INT-HOUSE', 'MAT-GENE-DROP-SHEET-07',  6,  1,     5, 'Drop sheets'),
  ('ASM-PAINT-INT-HOUSE', 'MAT-GENE-MASQ-TAPE-08',   6,  1,     6, 'Masking tape'),
  ('ASM-PAINT-INT-HOUSE', 'EQ-PAINT-SPR',            3,  1,     7, 'Airless sprayer hire'),
  ('ASM-PAINT-INT-HOUSE', 'LAB-GEN-06',              12, 1,     8, 'Paint prep'),
  ('ASM-PAINT-INT-HOUSE', 'LAB-GEN-07',              20, 1,     9, 'Paint coats'),

  -- ── ASM-PAINT-EXT-FACADE — Exterior facade repaint ───────────────────
  ('ASM-PAINT-EXT-FACADE', 'MAT-GENE-PAINT-EXT-02',   20, 1.1,   0, 'Exterior paint'),
  ('ASM-PAINT-EXT-FACADE', 'MAT-GENE-PAINT-PRIM-03',  10, 1.1,   1, 'Primer sealer'),
  ('ASM-PAINT-EXT-FACADE', 'EQ-SCAFF-2',               3,  1,     2, 'Scaffold erection'),
  ('ASM-PAINT-EXT-FACADE', 'EQ-PAINT-SPR',             2,  1,     3, 'Airless sprayer hire'),
  ('ASM-PAINT-EXT-FACADE', 'LAB-GEN-06',               6,  1,     4, 'Paint prep'),
  ('ASM-PAINT-EXT-FACADE', 'LAB-GEN-07',              10,  1,     5, 'Paint coats'),

  -- ── ASM-INSULATION-CEIL — Ceiling insulation upgrade ──────────────────
  ('ASM-INSULATION-CEIL', 'MAT-PLAS-INSULATION-BAT-09', 20, 1.05, 0, 'Insulation batts'),
  ('ASM-INSULATION-CEIL', 'LAB-PLS-08',                 8,  1,    1, 'Install insulation'),
  ('ASM-INSULATION-CEIL', 'EQ-LADDER',                  2,  1,    2, 'Ladder hire'),

  -- ── ASM-INSULATION-WALL — Wall insulation retrofit ────────────────────
  ('ASM-INSULATION-WALL', 'MAT-PLAS-INSULATION-WALL-10', 16, 1.05, 0, 'Wall insulation'),
  ('ASM-INSULATION-WALL', 'MAT-PLAS-GYP-10-01',          12, 1.1,  1, 'Plasterboard'),
  ('ASM-INSULATION-WALL', 'LAB-PLS-08',                   6,  1,    2, 'Install insulation'),
  ('ASM-INSULATION-WALL', 'LAB-PLS-01',                   8,  1,    3, 'Fix plasterboard'),
  ('ASM-INSULATION-WALL', 'LAB-PLS-02',                   6,  1,    4, 'Set joints'),
  ('ASM-INSULATION-WALL', 'LAB-GEN-07',                   6,  1,    5, 'Paint coats'),

  -- ── ASM-ROOF-SARKING — Roof sarking replace ──────────────────────────
  ('ASM-ROOF-SARKING', 'MAT-GENE-ROOF-TILE-16',   20, 1.1,   0, 'Roof tiles'),
  ('ASM-ROOF-SARKING', 'MAT-GENE-MEMBRANE-30',    20, 1.1,   1, 'Building wrap/sarking'),
  ('ASM-ROOF-SARKING', 'MAT-GENE-ROOF-BED-17',     4,  1,    2, 'Bedding compound'),
  ('ASM-ROOF-SARKING', 'EQ-SCAFF-2',                3,  1,    3, 'Scaffold erection'),
  ('ASM-ROOF-SARKING', 'EQ-ROOF-HAR',               3,  1,    4, 'Roof harness'),
  ('ASM-ROOF-SARKING', 'LAB-GEN-10',               10,  1,    5, 'Roof repair labour'),

  -- ── ASM-ROOF-FLASH — Roof flashing replace ───────────────────────────
  ('ASM-ROOF-FLASH', 'VND-ROOF-REP',            1,  1,     0, 'Roof plumber subcontract'),
  ('ASM-ROOF-FLASH', 'MAT-GENE-ROOF-BED-17',   2,  1,     1, 'Bedding compound'),
  ('ASM-ROOF-FLASH', 'MAT-GENE-ROOF-PTG-18',   2,  1,     2, 'Pointing compound'),
  ('ASM-ROOF-FLASH', 'EQ-ROOF-HAR',             2,  1,     3, 'Roof harness'),
  ('ASM-ROOF-FLASH', 'LAB-GEN-10',              4,  1,     4, 'Roof repair labour'),

  -- ── ASM-BALUSTRADE — Balustrade replace ───────────────────────────────
  ('ASM-BALUSTRADE', 'MAT-CARP-TIMBER-90-01',  12, 1.1,    0, 'Framing timber'),
  ('ASM-BALUSTRADE', 'LAB-CAR-01',              8,  1,     1, 'Frame labour'),
  ('ASM-BALUSTRADE', 'LAB-GEN-07',              3,  1,     2, 'Paint coats'),

  -- ── ASM-GARAGE-DOOR — Garage door replace ─────────────────────────────
  ('ASM-GARAGE-DOOR', 'VND-GLAZ-2',            1,  1,     0, 'Glazed door supply/install'),
  ('ASM-GARAGE-DOOR', 'LAB-CAR-01',            4,  1,     1, 'Frame labour'),
  ('ASM-GARAGE-DOOR', 'LAB-ELE-01',            2,  1,     2, 'Electrical for opener'),

  -- ── ASM-SECURITY-DOOR — Security screen door ─────────────────────────
  ('ASM-SECURITY-DOOR', 'VND-SECURITY',          1,  1,     0, 'Security system repair'),
  ('ASM-SECURITY-DOOR', 'LAB-CAR-02',           2,  1,     1, 'Hang door labour'),

  -- ── ASM-EVACUATE-SERVICE — Evacuation service ────────────────────────
  ('ASM-EVACUATE-SERVICE', 'OTH-CONTENTS-MOVE',     1,  1,     0, 'Contents pack out'),
  ('ASM-EVACUATE-SERVICE', 'OTH-CONTENTS-IN',       1,  1,     1, 'Contents pack in'),
  ('ASM-EVACUATE-SERVICE', 'OTH-STORE-HIRE',        1,  1,     2, 'Storage hire'),

  -- ── ASM-ACCESS-EQ — Access equipment pack ────────────────────────────
  ('ASM-ACCESS-EQ', 'EQ-SCAFF-1',     5,  1,     0, 'Scaffold hire'),
  ('ASM-ACCESS-EQ', 'EQ-SCAFF-2',     2,  1,     1, 'Scaffold erection'),
  ('ASM-ACCESS-EQ', 'EQ-LADDER',      3,  1,     2, 'Ladder hire'),
  ('ASM-ACCESS-EQ', 'EQ-ROOF-HAR',    2,  1,     3, 'Roof harness'),

  -- ── ASM-QA-HANDOVER — QA handover pack ───────────────────────────────
  ('ASM-QA-HANDOVER', 'LAB-GEN-15',       2,  1,     0, 'Site supervision'),
  ('ASM-QA-HANDOVER', 'LAB-GEN-05',       3,  1,     1, 'Final builders clean'),
  ('ASM-QA-HANDOVER', 'OTH-PHOTO-DOC',    1,  1,     2, 'Photo documentation')

) AS v(asm_code, comp_code, qty, wf, si, note)
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_assembly_components bom
  WHERE bom.assembly_id = (SELECT id FROM catalog_items WHERE code = v.asm_code AND tenant_id = t.id)
    AND bom.tenant_id = t.id
  LIMIT 1
);

COMMIT;

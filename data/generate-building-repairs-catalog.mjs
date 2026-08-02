#!/usr/bin/env node
/**
 * Generates two related seed catalogues for residential insurance building repairs:
 *
 * 1. data/building-repairs-catalog.csv — flat primitive + fixed-price assembly catalogue
 *    (Crunchwork-style import format used by CatalogBootstrapService).
 * 2. data/internal-assembly-bom.json — internal "computed" pricing companion: for every
 *    assembly, the bill of materials (component primitive codes + quantity + waste factor)
 *    used to derive the assembly's cost from its underlying primitives.
 *
 * All in-memory item objects are built first ({ kind, code, display, desc, type, category,
 * unit, buy, unitCost, fixed, ... }) and CSV rows are only serialized at the very end, so the
 * BOM generator can reference primitive codes reliably (and validate every reference exists).
 *
 * Run: node data/generate-building-repairs-catalog.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_OUT = join(__dirname, 'building-repairs-catalog.csv');
const BOM_OUT = join(__dirname, 'internal-assembly-bom.json');

const TARGET_PRIMITIVES = 520;

const HEADER = [
  'code',
  'display_name',
  'line_item_description',
  'kind',
  'type_code',
  'category_code',
  'unit_type_ref',
  'unit_cost',
  'buy_cost',
  'markup_type',
  'markup_value',
  'tax_rate',
  'pricing_mode',
  'fixed_unit_cost',
  'external_reference',
];

function esc(value) {
  if (value == null || value === '') return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(fields) {
  return fields.map(esc).join(',');
}

// ── In-memory catalogue objects ──────────────────────────────────────────────
// Every item is a plain object; CSV rows are derived from these at the end so
// the BOM builder can look items up by `code` without re-parsing CSV text.

const primitives = [];
const assemblyDefs = [];

// Lookup pools used by the BOM generator, keyed by category, populated as
// primitives are created below.
const pools = {
  material: {},
  labour: {},
  equipment: {},
  vendor: {},
  other: {},
};

function poolFor(type, category) {
  const byCategory = pools[type];
  if (!byCategory[category]) byCategory[category] = [];
  return byCategory[category];
}

/**
 * @param {object} p
 * `named` distinguishes curated, realistic catalogue entries (materialSets,
 * labourTrades, equipment, vendors, other) from bulk filler/padding entries
 * (variants, extraLabour) used only to reach volume targets. The BOM builder
 * biases toward `named` primitives so generated bills of materials read as
 * realistic trade scope rather than generic filler codes.
 */
function addPrimitive(p) {
  const buy = p.buy ?? p.unitCost * 0.75;
  const unitCost = p.unitCost ?? Math.round(buy * 1.2 * 100) / 100;
  const item = {
    kind: 'primitive',
    code: p.code,
    display: p.display,
    desc: p.desc,
    type: p.type,
    category: p.category,
    unit: p.unit,
    buy: Number(buy.toFixed(2)),
    unitCost: Number(unitCost.toFixed(2)),
    markupType: p.markupType ?? 'percent',
    markup: p.markup ?? 20,
    tax: p.tax ?? '0.10',
    ext: p.ext ?? '',
    named: p.named ?? true,
  };
  primitives.push(item);
  poolFor(p.type, p.category).push(item);
  return item;
}

/** @param {object} p */
function addAssembly(p) {
  const item = {
    kind: 'assembly',
    code: p.code,
    display: p.display,
    desc: p.desc,
    type: p.type,
    category: p.category,
    fixed: Number((p.fixed ?? 0).toFixed(2)),
    tax: p.tax ?? '0.10',
    ext: p.ext ?? '',
  };
  assemblyDefs.push(item);
  return item;
}

function toCsvRow(item) {
  if (item.kind === 'primitive') {
    return csvRow([
      item.code,
      item.display,
      item.desc,
      'primitive',
      item.type,
      item.category,
      item.unit,
      item.unitCost.toFixed(2),
      item.buy.toFixed(2),
      item.markupType,
      item.markup,
      item.tax,
      '',
      '',
      item.ext,
    ]);
  }
  return csvRow([
    item.code,
    item.display,
    item.desc,
    'assembly',
    item.type,
    item.category,
    '',
    '',
    '',
    '',
    '',
    item.tax,
    'fixed',
    item.fixed.toFixed(2),
    item.ext,
  ]);
}

// ── Materials by trade (programmatic expansion) ─────────────────────────────

const materialSets = {
  electrical: [
    ['GPO', 'GPO double power outlet', 'Supply and install double gang general purpose outlet including back box and plate'],
    ['SW-1', 'Single light switch', 'Supply and install single gang light switch including back box and cover plate'],
    ['SW-2', 'Two-way light switch', 'Supply and install two-way light switch wired for stair or multi-entry control'],
    ['LED-DOWN', 'LED downlight', 'Supply and install LED recessed downlight cut into ceiling with fire-rated boot where required'],
    ['SMK-ALARM', 'Smoke alarm', 'Supply and install hard-wired photoelectric smoke alarm to current standard'],
    ['RCD', 'RCD safety switch', 'Supply and install residual current device on sub-circuit'],
    ['CABLE-2.5', '2.5mm TPS cable', 'Supply 2.5mm twin and earth cable per metre for power circuits'],
    ['CABLE-1.5', '1.5mm TPS cable', 'Supply 1.5mm twin and earth cable per metre for lighting circuits'],
    ['CB', 'Circuit breaker', 'Supply and install single pole circuit breaker in switchboard'],
    ['METER-BOX', 'Meter box enclosure', 'Supply meter box enclosure and labelling for reconnection works'],
    ['FAN-EX', 'Exhaust fan', 'Supply and install ceiling or wall exhaust fan with duct to external grille'],
    ['HWS-ELE', 'Electric HWS element', 'Supply and install electric hot water service element and thermostat'],
    ['DATA-PT', 'Data point', 'Supply and install single RJ45 data outlet and patch lead termination'],
    ['CEILING-FAN', 'Ceiling fan', 'Supply and install ceiling fan with wall controller on existing circuit'],
    ['FLOOD-LGT', 'External flood light', 'Supply and install weatherproof LED floodlight with PIR sensor'],
  ],
  plumbing: [
    ['TAP-MIX', 'Basin mixer tap', 'Supply and install basin mixer tap including flex hoses and connections'],
    ['TAP-SINK', 'Sink mixer tap', 'Supply and install kitchen sink mixer with flexible connections'],
    ['TOILET-SUITE', 'Toilet suite', 'Supply and install close coupled toilet suite including pan collar and cistern'],
    ['CISTERN', 'Toilet cistern', 'Supply and replace toilet cistern including inlet and outlet valve set'],
    ['SHOWER-HEAD', 'Shower head set', 'Supply and install shower rose and arm with water saving rating'],
    ['SHOWER-SCREEN', 'Shower screen', 'Supply and install framed shower screen to standard opening'],
    ['FLEX-HOSE', 'Flexible water hose', 'Supply and install stainless braided flex hose connection'],
    ['PTR-VALVE', 'PTR valve', 'Supply and replace pressure temperature relief valve on hot water service'],
    ['PIPE-COP-15', '15mm copper pipe', 'Supply 15mm copper tube per metre for water reticulation'],
    ['PIPE-COP-20', '20mm copper pipe', 'Supply 20mm copper tube per metre for main runs'],
    ['PIPE-PVC-50', '50mm PVC waste', 'Supply 50mm PVC waste pipe per metre including fittings allowance'],
    ['PIPE-PVC-100', '100mm sewer pipe', 'Supply 100mm PVC sewer pipe per metre for underground repair'],
    ['FLOOR-WASTE', 'Floor waste grate', 'Supply and install chrome floor waste grate and trap connection'],
    ['SINK-BL', 'Stainless sink', 'Supply and install single bowl stainless steel sink with clips'],
    ['DISHWASHER-VALVE', 'Dishwasher tap', 'Supply and install mini stop and dishwasher connection point'],
    ['HWS-UNIT', 'Hot water service', 'Supply and install electric storage hot water unit including valves'],
    ['GAS-COOKTOP', 'Gas cooktop conn.', 'Reconnect gas cooktop with new flex and isolation valve certification'],
    ['WATER-HAMMER', 'Water hammer arrestor', 'Supply and install water hammer arrestor on quick closing valve line'],
    ['BACKFLOW', 'Backflow preventer', 'Supply and test backflow prevention device on mains connection'],
    ['TMV', 'TMV mixing valve', 'Supply and install thermostatic mixing valve for scald protection'],
  ],
  plastering: [
    ['GYP-10', 'Gyprock 10mm sheet', 'Supply 10mm plasterboard sheet 2400×1200 for wall or ceiling lining'],
    ['GYP-13', 'Gyprock 13mm sheet', 'Supply 13mm plasterboard sheet for wet area or fire rating'],
    ['GYP-MR', 'Moisture resistant board', 'Supply moisture resistant plasterboard for bathroom and laundry'],
    ['GYP-FR', 'Fire rated board', 'Supply fire rated plasterboard to specified FRL requirement'],
    ['CORNER-BEAD', 'Metal corner bead', 'Supply and fix metal corner bead to external plasterboard angles'],
    ['STOP-BEAD', 'Stop bead', 'Supply and fix stop bead at plasterboard termination junctions'],
    ['JOINT-CMP', 'Joint compound', 'Supply pre-mixed joint compound for taping and finishing coats'],
    ['PAPER-TAPE', 'Paper joint tape', 'Supply paper tape for plasterboard joint treatment'],
    ['INSULATION-BAT', 'Ceiling insulation bat', 'Supply and install ceiling insulation batts to required R-value'],
    ['INSULATION-WALL', 'Wall insulation bat', 'Supply and install wall cavity insulation batts'],
    ['SUSP-CEIL', 'Suspended ceiling grid', 'Supply suspended ceiling grid components per square metre'],
    ['CEIL-TILE', 'Ceiling tile', 'Supply acoustic ceiling tile to match existing grid system'],
    ['RENDER-BAG', 'Render mix bag', 'Supply bagged cement render for patch repairs to masonry'],
    ['TEXT-COAT', 'Texture coat compound', 'Supply texture coat for stipple or orange peel finish match'],
    ['TIMBER-BAT', 'Ceiling batten', 'Supply timber ceiling battens for strap and line set down'],
  ],
  carpentry: [
    ['TIMBER-90', '90×45 framing timber', 'Supply 90×45 MGP10 framing timber per metre for wall framing'],
    ['TIMBER-70', '70×35 battens', 'Supply 70×35 battens per metre for ceiling or cladding fixings'],
    ['TIMBER-140', '140×45 floor joist', 'Supply 140×45 floor joist timber per metre for floor repair'],
    ['PLY-12', '12mm structural ply', 'Supply 12mm structural plywood sheet for subfloor or bracing'],
    ['PLY-17', '17mm flooring ply', 'Supply 17mm flooring grade plywood for tile or vinyl substrate'],
    ['SKIR-MDF', 'MDF skirting', 'Supply primed MDF skirting profile per linear metre'],
    ['SKIR-TIM', 'Timber skirting', 'Supply timber skirting profile per linear metre to match existing'],
    ['ARCHITRAVE', 'Timber architrave', 'Supply timber architrave per linear metre to match existing profile'],
    ['DOOR-JAMB', 'Door jamb set', 'Supply and install pre-hung door jamb set to standard opening'],
    ['DOOR-BED', 'Internal hollow core door', 'Supply hollow core internal door slab to standard size'],
    ['DOOR-SOL', 'Solid core door', 'Supply solid core internal door slab for acoustic or fire separation'],
    ['LOCKSET', 'Entrance lockset', 'Supply and install entrance lockset with keyed cylinder'],
    ['HET-PASS', 'Privacy lockset', 'Supply and install privacy set for bathroom or bedroom door'],
    ['HINGE-PAIR', 'Door hinge pair', 'Supply and install ball bearing door hinge pair'],
    ['CAB-SHELF', 'Adjustable shelf', 'Supply and install adjustable shelf and supports in cupboard'],
    ['KICK-BOARD', 'Kitchen kickboard', 'Supply and install kitchen kickboard panel to match cabinetry'],
    ['BENCH-TOP', 'Laminate benchtop', 'Supply and install laminate benchtop with masonite substrate per lm'],
    ['CAB-HINGE', 'Soft close hinge', 'Supply and install soft close cabinet hinge pair'],
    ['DRAW-RUNNER', 'Drawer runner set', 'Supply and install ball bearing drawer runner set'],
    ['DECK-BRD', 'Decking board', 'Supply hardwood or composite decking board per linear metre'],
  ],
  general: [
    ['PAINT-INT', 'Interior paint litre', 'Supply premium interior low sheen paint per litre including tint'],
    ['PAINT-EXT', 'Exterior paint litre', 'Supply exterior acrylic paint per litre including UV resistant tint'],
    ['PAINT-PRIM', 'Primer sealer litre', 'Supply stain blocking primer sealer per litre for repair preparation'],
    ['PAINT-UNDR', 'Undercoat litre', 'Supply undercoat per litre for timber and metal preparation'],
    ['FILL-GAP', 'Gap filler tube', 'Supply paintable gap filler cartridge for internal joints'],
    ['SAND-PAPER', 'Sandpaper pack', 'Supply assorted grit sandpaper for preparation and finishing'],
    ['DROP-SHEET', 'Canvas drop sheet', 'Supply canvas drop sheet for floor and furniture protection'],
    ['MASQ-TAPE', 'Masking tape roll', 'Supply low tack masking tape for paint masking'],
    ['TILE-CER', 'Ceramic floor tile', 'Supply ceramic floor tile per square metre allowance for wastage'],
    ['TILE-POR', 'Porcelain wall tile', 'Supply porcelain wall tile per square metre for wet areas'],
    ['TILE-ADH', 'Tile adhesive bag', 'Supply flexible tile adhesive bag for floor or wall installation'],
    ['GROUT-BAG', 'Tile grout bag', 'Supply colour matched tile grout for joint finishing'],
    ['VINYL-PLK', 'Vinyl plank', 'Supply luxury vinyl plank flooring per square metre'],
    ['CARPET', 'Carpet supply', 'Supply residential carpet per square metre including underlay allowance'],
    ['UNDERLAY', 'Carpet underlay', 'Supply carpet underlay per square metre'],
    ['ROOF-TILE', 'Concrete roof tile', 'Supply concrete roof tile to match existing profile'],
    ['ROOF-BED', 'Roof bedding compound', 'Supply roof bedding mortar for ridge and hip repointing'],
    ['ROOF-PTG', 'Roof pointing compound', 'Supply flexible roof pointing compound for ridge capping'],
    ['GUTTER-QUAD', 'Quad gutter', 'Supply quad profile colorbond gutter per linear metre'],
    ['DOWNPIPE', 'Downpipe section', 'Supply colorbond downpipe per linear metre with brackets'],
    ['FASCIA', 'Fascia board', 'Supply primed fascia board per linear metre'],
    ['BARGE', 'Barge board', 'Supply barge board per linear metre to match roof line'],
    ['FENCE-PAL', 'Paling fence panel', 'Supply treated pine paling fence per linear metre'],
    ['GATE-SGL', 'Side gate', 'Supply and hang side gate in timber or metal to match fence'],
    ['CONCRETE-M3', 'Concrete supply', 'Supply 25 MPa concrete per cubic metre for path or slab repair'],
    ['REO-MESH', 'Reinforcing mesh sheet', 'Supply SL72 reinforcing mesh sheet for slab repair'],
    ['BRICK-STD', 'Standard brick', 'Supply standard clay brick per unit for patch masonry'],
    ['MORTAR-BAG', 'Mortar mix bag', 'Supply bricklaying mortar mix bag for repair work'],
    ['ASB-SHEET', 'FC sheeting', 'Supply fibre cement sheet for external cladding repair'],
    ['MEMBRANE', 'Building wrap', 'Supply breathable building wrap per square metre'],
    ['HVAC-FILTER', 'Return air filter', 'Supply and replace return air grille filter after dust remediation'],
    ['CLEAN-SOL', 'Cleaning solution', 'Supply antimicrobial cleaning solution for mould wash down'],
    ['MOULD-TRT', 'Mould treatment', 'Supply mould treatment chemical for affected porous surfaces'],
    ['HEPA-FILTER', 'HEPA filter cartridge', 'Supply HEPA filter cartridge for air scrubber during remediation'],
    ['ASB-TEST', 'Asbestos sample test', 'Supply NATA laboratory asbestos sample testing fee per sample'],
    ['SKIP-4M', '4m skip bin', 'Supply 4 cubic metre skip bin including delivery and collection'],
    ['SKIP-6M', '6m skip bin', 'Supply 6 cubic metre skip bin including delivery and collection'],
    ['POLY-SHEET', 'Polyethylene sheet', 'Supply 200 micron poly sheet per square metre for containment'],
    ['TAPE-ZONE', 'Contamination tape', 'Supply hazard tape for containment zone demarcation'],
    ['TEMP-FENCE', 'Temporary fence panel', 'Supply temporary fence panel hire per day for site safety'],
    ['TEMP-TOIL', 'Portable toilet hire', 'Supply portable toilet hire per week on active site'],
    ['SITE-SIGN', 'Site safety signage', 'Supply site safety and warning signage pack for active works'],
    ['FIRST-AID', 'First aid kit', 'Supply compliant site first aid kit for duration of works'],
  ],
};

for (const [category, defs] of Object.entries(materialSets)) {
  for (let i = 0; i < defs.length; i++) {
    const [suffix, display, desc] = defs[i];
    const buy = 8 + (i % 17) * 3.5 + category.length;
    addPrimitive({
      code: `MAT-${category.toUpperCase().slice(0, 4)}-${suffix}-${String(i + 1).padStart(2, '0')}`,
      display,
      desc,
      type: 'material',
      category,
      unit: 'ea',
      buy,
    });
  }
}

// ── Labour rates by trade ───────────────────────────────────────────────────

const labourTrades = {
  electrical: { prefix: 'LAB-ELE', rate: 95, tasks: [
    ['GPO install', 'Install power outlet', 'Labour to install and test general purpose outlet on existing circuit'],
    ['Switch install', 'Install light switch', 'Labour to install and test light switch including termination'],
    ['Downlight cut-in', 'Cut-in downlight', 'Labour to cut ceiling, install downlight and connect to circuit'],
    ['Switchboard upgrade', 'Switchboard labour', 'Labour to replace switchboard chassis and reconnect circuits'],
    ['Fault find', 'Electrical fault find', 'Labour to diagnose and locate electrical fault on domestic installation'],
    ['Smoke alarm test', 'Test smoke alarms', 'Labour to test and certify interconnected smoke alarm system'],
    ['Cable pull', 'Cable pull labour', 'Labour to pull and clip cable through wall or ceiling cavity'],
    ['Fan install', 'Install exhaust fan', 'Labour to install exhaust fan and duct to external discharge'],
    ['HWS reconnect', 'Reconnect HWS', 'Labour to disconnect and reconnect hot water service electrical supply'],
    ['Compliance test', 'Electrical compliance test', 'Labour to perform compliance testing and issue certificate'],
  ]},
  plumbing: { prefix: 'LAB-PLU', rate: 92, tasks: [
    ['Tap replace', 'Replace tapware', 'Labour to isolate, remove and install basin or sink tapware'],
    ['Toilet replace', 'Replace toilet suite', 'Labour to remove existing and install new toilet suite'],
    ['Leak repair', 'Repair water leak', 'Labour to locate and repair pressurised water leak'],
    ['Drain clear', 'Clear blocked drain', 'Labour and hand tools to clear blocked fixture drain line'],
    ['Pipe repair', 'Repair burst pipe', 'Labour to repair or splice burst water or waste pipe in accessible location'],
    ['HWS install', 'Install HWS', 'Labour to position and connect storage hot water service'],
    ['Shower install', 'Install shower', 'Labour to install shower screen valves and test for leaks'],
    ['Rough-in', 'Plumbing rough-in', 'Labour for rough-in water and waste pipework to wet area'],
    ['Fit-off', 'Plumbing fit-off', 'Labour for final fit-off of fixtures and appliances in wet area'],
    ['CCTV inspect', 'Drain camera inspect', 'Labour to perform CCTV inspection of sewer line and report findings'],
  ]},
  plastering: { prefix: 'LAB-PLS', rate: 78, tasks: [
    ['Sheet fix', 'Fix plasterboard', 'Labour to measure cut and fix plasterboard sheets to framing'],
    ['Set joints', 'Set plaster joints', 'Labour to tape and three coat set plasterboard joints'],
    ['Sand finish', 'Sand plaster finish', 'Labour to sand plasterboard joints to smooth paint ready finish'],
    ['Patch repair', 'Patch plaster repair', 'Labour to patch repair damaged plasterboard to blend with existing'],
    ['Ceiling set down', 'Ceiling set down', 'Labour to strap and line set down ceiling after water damage'],
    ['Cornice install', 'Install cornice', 'Labour to install plaster cornice to wall and ceiling junction'],
    ['Render patch', 'Render patch repair', 'Labour to patch repair external render to match texture'],
    ['Insulation install', 'Install insulation', 'Labour to install ceiling or wall insulation batts'],
    ['Texture match', 'Match stipple texture', 'Labour to replicate stipple or texture finish on patched area'],
    ['Vacuum sand', 'Vacuum sanding', 'Labour for dust controlled vacuum sanding in occupied premises'],
  ]},
  carpentry: { prefix: 'LAB-CAR', rate: 85, tasks: [
    ['Frame wall', 'Frame internal wall', 'Labour to construct internal stud wall frame to plan'],
    ['Hang door', 'Hang internal door', 'Labour to hang and adjust internal door in existing jamb'],
    ['Skirting install', 'Install skirting', 'Labour to measure cut and fix skirting boards'],
    ['Architrave install', 'Install architrave', 'Labour to install architrave around door openings'],
    ['Floor repair', 'Repair floor structure', 'Labour to splice or sister floor joists and replace damaged bearer'],
    ['Deck repair', 'Repair decking', 'Labour to replace damaged decking boards and fixings'],
    ['Cabinet install', 'Install cabinetry', 'Labour to install base or wall cabinet and align doors'],
    ['Lock change', 'Change door locks', 'Labour to replace locksets and rekey to new combination'],
    ['Window lining', 'Install window lining', 'Labour to install internal window architrave and sill lining'],
    ['Stair repair', 'Repair stair tread', 'Labour to replace damaged stair tread and nosing'],
  ]},
  general: { prefix: 'LAB-GEN', rate: 72, tasks: [
    ['Make safe', 'Make safe attendance', 'Labour for emergency make safe attendance including temporary propping'],
    ['Strip out', 'Strip out wet area', 'Labour to strip out wet area fixtures linings and dispose off site'],
    ['Demo strip', 'Demo strip out', 'Labour to demolish and remove damaged linings and fittings'],
    ['Rubbish removal', 'Manual rubbish removal', 'Labour to collect and load debris for disposal'],
    ['Clean final', 'Final builders clean', 'Labour for final builders clean prior to handover'],
    ['Paint prep', 'Prepare for painting', 'Labour to wash fill sand and mask surfaces for painting'],
    ['Paint apply', 'Apply paint coats', 'Labour to apply two coats paint to walls or ceilings'],
    ['Tile lay', 'Lay floor tiles', 'Labour to lay floor tiles including cutting and grouting'],
    ['Carpet lay', 'Lay carpet', 'Labour to lay carpet including trim and stretch to gripper'],
    ['Roof repair', 'Roof repair labour', 'Labour to replace broken tiles and rebed ridge capping'],
    ['Fence repair', 'Fence repair labour', 'Labour to replace fence palings rails and posts'],
    ['Concrete patch', 'Patch concrete', 'Labour to form and finish concrete patch repair to path or slab'],
    ['Mould clean', 'Mould remediation clean', 'Labour for HEPA vacuum and antimicrobial wash of mould affected surfaces'],
    ['Containment', 'Build containment', 'Labour to erect poly containment and negative air enclosure'],
    ['Supervision', 'Site supervision', 'Labour for on-site supervision and coordination of repair trades'],
    ['Travel', 'Travel allowance', 'Travel time allowance to regional insurance repair site'],
  ]},
};

for (const [category, trade] of Object.entries(labourTrades)) {
  for (let i = 0; i < trade.tasks.length; i++) {
    const [, display, desc] = trade.tasks[i];
    const buy = trade.rate + (i % 5) * 2;
    addPrimitive({
      code: `${trade.prefix}-${String(i + 1).padStart(2, '0')}`,
      display: `${display} (per hr)`,
      desc,
      type: 'labour',
      category,
      unit: 'hr',
      buy,
    });
  }
}

// ── Equipment hire ──────────────────────────────────────────────────────────

const equipment = [
  ['EQ-SCAFF-1', 'Scaffold hire', 'Hire mobile aluminium scaffold tower per day for internal access works', 'general', 85],
  ['EQ-SCAFF-2', 'Scaffold erection', 'Erect and dismantle fixed scaffold per day for external access', 'general', 320],
  ['EQ-LADDER', 'Platform ladder hire', 'Hire platform ladder per day for ceiling and roof access', 'general', 45],
  ['EQ-PAINT-SPR', 'Airless sprayer hire', 'Hire airless paint sprayer per day including tip and hose', 'general', 95],
  ['EQ-DEHUM', 'Dehumidifier hire', 'Hire commercial dehumidifier per day for drying water damaged building', 'general', 75],
  ['EQ-AIR-SCRUB', 'Air scrubber hire', 'Hire HEPA air scrubber per day for dust and mould remediation', 'general', 110],
  ['EQ-FAN', 'Axial fan hire', 'Hire axial fan per day for drying and ventilation during repairs', 'general', 55],
  ['EQ-DRAIN-JET', 'Drain jetter hire', 'Hire high pressure drain jetter per day with operator allowance', 'plumbing', 280],
  ['EQ-CCTV', 'Drain camera hire', 'Hire drain CCTV inspection unit per day', 'plumbing', 190],
  ['EQ-CORE-DRILL', 'Core drill hire', 'Hire core drill unit per day for slab or wall penetrations', 'general', 65],
  ['EQ-FLOOR-SAND', 'Floor sander hire', 'Hire drum floor sander per day for timber floor restoration', 'carpentry', 120],
  ['EQ-CONCRETE-CUT', 'Concrete cutter hire', 'Hire concrete cut off saw per day for patch breakout', 'general', 80],
  ['EQ-LIFT-1', 'Material lift hire', 'Hire material hoist per day for multi-storey material handling', 'general', 150],
  ['EQ-GEN-1', 'Generator hire 2kVA', 'Hire 2kVA portable generator per day for temporary power', 'electrical', 70],
  ['EQ-GEN-2', 'Generator hire 6kVA', 'Hire 6kVA portable generator per day for tools and temporary supply', 'electrical', 130],
  ['EQ-LIGHT-TOWER', 'Light tower hire', 'Hire portable light tower per day for after hours make safe', 'general', 95],
  ['EQ-HEPA-VAC', 'HEPA vacuum hire', 'Hire commercial HEPA vacuum per day for remediation works', 'general', 88],
  ['EQ-PUMP-SUB', 'Submersible pump hire', 'Hire submersible pump per day for flood water extraction', 'plumbing', 60],
  ['EQ-MOIST-MTR', 'Moisture meter hire', 'Hire moisture meter per day for drying verification readings', 'general', 35],
  ['EQ-TILE-CUT', 'Tile cutter hire', 'Hire wet tile cutter per day for floor and wall tiling works', 'general', 45],
  ['EQ-PLASTER-BOOM', 'Plasterboard lift', 'Hire plasterboard panel lift per day for ceiling sheet install', 'plastering', 75],
  ['EQ-NAIL-GUN', 'Framing nailer hire', 'Hire compressed air framing nailer per day for rebuild framing', 'carpentry', 55],
  ['EQ-COMPRESSOR', 'Air compressor hire', 'Hire portable air compressor per day to run pneumatic tools', 'general', 50],
  ['EQ-ROOF-HAR', 'Roof harness kit', 'Hire roof safety harness and anchor kit per day', 'general', 40],
  ['EQ-EXC-MINI', 'Mini excavator hire', 'Hire mini excavator per day for footing or drainage excavation', 'general', 450],
];

for (const [code, display, desc, category, buy] of equipment) {
  addPrimitive({ code, display, desc, type: 'equipment', category, unit: 'ea', buy });
}

// ── Vendor / subcontract lump sums ──────────────────────────────────────────

const vendors = [
  ['VND-ASB-REMOVAL', 'Asbestos removal', 'Subcontract licensed asbestos removal including clearance certificate', 'general', 2800],
  ['VND-ASB-FRIABLE', 'Friable asbestos removal', 'Subcontract friable asbestos removal with full enclosure and air monitoring', 'general', 6500],
  ['VND-ROOF-REP', 'Roof plumbing subcontract', 'Subcontract roof plumber to replace valley irons and flashings', 'general', 1850],
  ['VND-ROOF-METAL', 'Metal roof replacement', 'Subcontract colorbond roof sheet replacement to matched profile', 'general', 4200],
  ['VND-GLAZ-1', 'Glazier single window', 'Subcontract glazier to supply and install single aluminium window unit', 'carpentry', 680],
  ['VND-GLAZ-2', 'Glazed sliding door', 'Subcontract supply and install aluminium sliding door with safety glass', 'carpentry', 1450],
  ['VND-SPRINKLER', 'Fire sprinkler repair', 'Subcontract fire sprinkler fitter to repair damaged head and pipework', 'plumbing', 920],
  ['VND-SECURITY', 'Security system repair', 'Subcontract security technician to replace panel and sensors', 'electrical', 780],
  ['VND-POOL-FENCE', 'Pool fence compliance', 'Subcontract pool fence supply and install to compliance standard', 'general', 2200],
  ['VND-TERMITE', 'Termite treatment', 'Subcontract termite barrier treatment to affected subfloor zone', 'general', 1650],
  ['VND-ENGINEER', 'Engineer inspection', 'Subcontract structural engineer site inspection and written report', 'general', 890],
  ['VND-SURVEY', 'Surveyor set out', 'Subcontract surveyor set out for boundary or building alignment', 'general', 750],
  ['VND-HYDRO', 'Hydro excavation', 'Subcontract non destructive hydro excavation near services', 'plumbing', 1200],
  ['VND-STEEL-FAB', 'Steel fabricator', 'Subcontract steel fabricator for lintel or bearer replacement', 'carpentry', 980],
  ['VND-KITCH-FAB', 'Kitchen manufacturer', 'Subcontract kitchen manufacturer supply flat pack or custom cabinets', 'carpentry', 5600],
  ['VND-STONE-BENCH', 'Stone benchtop', 'Subcontract stone benchtop template supply and install', 'carpentry', 3200],
  ['VND-SOLAR-DIS', 'Solar disconnect', 'Subcontract electrician to isolate and reconnect rooftop solar system', 'electrical', 650],
  ['VND-EVAP-AC', 'Evaporative AC service', 'Subcontract service and repair evaporative air conditioning unit', 'general', 480],
  ['VND-SPLIT-AC', 'Split system AC', 'Subcontract supply and install split system air conditioner', 'general', 2100],
  ['VND-FLOOD-REST', 'Flood restoration co', 'Subcontract flood restoration company initial extraction and dry out', 'general', 1900],
  ['VND-MOULD-CERT', 'Mould clearance test', 'Subcontract independent mould clearance sampling and laboratory report', 'general', 420],
  ['VND-ARBORIST', 'Arborist tree work', 'Subcontract arborist to remove tree damaging structure', 'general', 1100],
  ['VND-PIER-REP', 'Underpinning contractor', 'Subcontract underpinning or pier replacement to stabilise footing', 'general', 8500],
  ['VND-FENC-COLOR', 'Colorbond fencing', 'Subcontract colorbond boundary fencing per linear metre supply and install', 'general', 240],
  ['VND-DRIVE-REP', 'Driveway specialist', 'Subcontract driveway repair including cut out and reinstatement', 'general', 3200],
  ['VND-ALARM-MON', 'Alarm monitoring', 'Subcontract alarm monitoring reconnection fee for restored premises', 'electrical', 180],
  ['VND-LOCKSMITH', 'Locksmith rekey', 'Subcontract locksmith to rekey all external doors after damage', 'carpentry', 320],
  ['VND-CLEAN-DEEP', 'Specialist deep clean', 'Subcontract specialist deep clean after fire or sewage contamination', 'general', 680],
  ['VND-PEST-TREAT', 'Pest treatment', 'Subcontract pest controller treatment after rodent or insect damage', 'general', 290],
  ['VND-INSULATION-BLOW', 'Blown insulation', 'Subcontract blown insulation installer to required ceiling R-value', 'plastering', 14],
];

for (const [code, display, desc, category, buy] of vendors) {
  addPrimitive({ code, display, desc, type: 'vendor', category, unit: 'ea', buy });
}

// ── Other (permits, fees, allowances) ───────────────────────────────────────

const other = [
  ['OTH-BLD-PERM', 'Building permit fee', 'Council building permit fee allowance for repair works', 'general', 450],
  ['OTH-PLM-PERM', 'Plumbing permit fee', 'Plumbing compliance certificate and permit fee allowance', 'plumbing', 180],
  ['OTH-ELE-COC', 'Electrical CoC fee', 'Electrical certificate of compliance and inspection fee allowance', 'electrical', 220],
  ['OTH-WASTE-TIP', 'Landfill gate fee', 'Landfill gate fee allowance per tonne for mixed construction waste', 'general', 95],
  ['OTH-ENV-FEE', 'Environmental levy', 'Environmental levy on waste disposal for insurance repair debris', 'general', 35],
  ['OTH-PC-ITEM', 'PC item allowance', 'Prime cost allowance item for owner selected fixture not yet specified', 'general', 500],
  ['OTH-PS-ITEM', 'Provisional sum', 'Provisional sum allowance for unforeseen repair scope discovered on site', 'general', 1500],
  ['OTH-INS-EXCESS', 'Policy excess admin', 'Administrative handling of policy excess for insured repair claim', 'general', 0],
  ['OTH-QUOTE-VISIT', 'Quote site visit', 'Allowance for initial site inspection and scope documentation visit', 'general', 120],
  ['OTH-PHOTO-DOC', 'Photo documentation', 'Allowance for photographic condition documentation for insurer report', 'general', 85],
  ['OTH-AFTER-HRS', 'After hours call out', 'After hours emergency call out fee for make safe attendance', 'general', 280],
  ['OTH-WEEKEND', 'Weekend loading', 'Weekend labour loading allowance on approved restoration works', 'general', 0],
  ['OTH-REMOTE', 'Remote location load', 'Remote location loading allowance for travel zone repairs', 'general', 350],
  ['OTH-STORE-HIRE', 'Storage pod hire', 'Storage pod hire per month for contents during building repairs', 'general', 320],
  ['OTH-CONTENTS-MOVE', 'Contents pack out', 'Allowance for contents pack out and inventory for storage', 'general', 680],
  ['OTH-CONTENTS-IN', 'Contents pack in', 'Allowance for contents pack back after repairs complete', 'general', 680],
  ['OTH-TEMP-KITCH', 'Temporary kitchen', 'Hire temporary kitchen pod during kitchen restoration works', 'general', 890],
  ['OTH-TEMP-BATH', 'Temporary bathroom', 'Hire temporary bathroom pod during wet area restoration', 'plumbing', 950],
  ['OTH-SECURITY-BOARD', 'Security board up', 'Supply and install security board up to openings after break-in damage', 'carpentry', 420],
  ['OTH-TARP-ROOF', 'Emergency roof tarp', 'Supply and secure heavy duty tarpaulin over damaged roof area', 'general', 380],
];

for (const [code, display, desc, category, buy] of other) {
  addPrimitive({ code, display, desc, type: 'other', category, unit: 'ea', buy: buy || 50 });
}

// ── Expanded material variants (bulk generation for volume) ────────────────

const variants = [
  ['electrical', 'GPO', 'Power outlet variant', 'Supply and install power outlet variant to match existing wiring'],
  ['electrical', 'Cable', 'Cable run variant', 'Supply additional cable and conduit for circuit extension'],
  ['plumbing', 'Fitting', 'Pipe fitting variant', 'Supply brass or PVC fitting for pipe repair junction'],
  ['plumbing', 'Sealant', 'Plumbing sealant', 'Supply plumbing grade sealant and thread tape for joint completion'],
  ['plastering', 'Bead', 'Plaster bead variant', 'Supply plaster bead or trim for junction detail'],
  ['plastering', 'Adhesive', 'Construction adhesive', 'Supply construction adhesive for sheet or trim bonding'],
  ['carpentry', 'Fixings', 'Fixings pack', 'Supply nails screws and anchors pack for carpentry repair'],
  ['carpentry', 'Adhesive', 'Timber adhesive', 'Supply polyurethane timber adhesive for splice joint'],
  ['general', 'Consumable', 'Consumable allowance', 'Supply consumable allowance for blades bits and sundries on repair job'],
  ['general', 'Seal', 'Silicone sealant', 'Supply neutral cure silicone for wet area perimeter seal'],
];

let variantIdx = 0;
while (primitives.filter((r) => r.type === 'material').length < 280) {
  const [cat, prefix, displayBase, descBase] = variants[variantIdx % variants.length];
  variantIdx++;
  const n = variantIdx;
  addPrimitive({
    code: `MAT-VAR-${prefix.toUpperCase()}-${String(n).padStart(3, '0')}`,
    display: `${displayBase} ${n}`,
    desc: `${descBase} — item ${n} for insurance repair scope scheduling`,
    type: 'material',
    category: cat,
    unit: 'ea',
    buy: 12 + (n % 40) * 2.2,
    named: false,
  });
}

// ── More labour variants to pad primitives up to TARGET_PRIMITIVES ─────────

const extraLabour = [
  ['electrical', 'Data and comms work', 'Labour for data comms or TV outlet installation'],
  ['electrical', 'Appliance connect', 'Labour to connect and test single domestic appliance'],
  ['plumbing', 'Appliance install', 'Labour to install dishwasher or washing machine'],
  ['plumbing', 'Gas leak make safe', 'Labour to isolate gas leak and make safe appliance'],
  ['plastering', 'Cornice repair', 'Labour to repair damaged cornice section'],
  ['plastering', 'Bulkhead build', 'Labour to construct plasterboard bulkhead'],
  ['carpentry', 'Stair balustrade', 'Labour to replace stair balustrade section'],
  ['carpentry', 'Wardrobe fit out', 'Labour to install wardrobe fit out kit'],
  ['general', 'Tile waterproof', 'Labour to apply liquid waterproof membrane'],
  ['general', 'Epoxy floor coat', 'Labour to apply epoxy coating to garage floor'],
  ['general', 'Pressure wash', 'Labour to pressure wash external surfaces'],
  ['general', 'Insulation removal', 'Labour to remove contaminated insulation'],
  ['general', 'Hoarding erect', 'Labour to erect temporary hoarding'],
  ['general', 'Traffic control', 'Labour for pedestrian traffic control during works'],
  ['general', 'Dust barrier', 'Labour to install zip wall dust barrier'],
];

let labExtra = 0;
while (primitives.length < TARGET_PRIMITIVES) {
  const [cat, display, desc] = extraLabour[labExtra % extraLabour.length];
  labExtra++;
  addPrimitive({
    code: `LAB-EXT-${String(labExtra).padStart(3, '0')}`,
    display: `${display} (per hr)`,
    desc: `${desc} for insurance building repair scope item ${labExtra}`,
    type: 'labour',
    category: cat,
    unit: 'hr',
    buy: 70 + (labExtra % 25) * 2,
    named: false,
  });
}

// ── Assemblies (scope packages, fixed pricing_mode) ─────────────────────────

const assemblies = [
  ['ASM-WET-BATH-REL', 'Bathroom relining', 'Assembly allowance for bathroom relining including waterproofing wall linings and fit-off', 'other', 'plumbing', 8500],
  ['ASM-WET-SHOWER-REL', 'Shower recess reline', 'Assembly allowance to reline shower recess including waterproof membrane and tiles', 'other', 'plumbing', 5200],
  ['ASM-WET-LAUNDRY', 'Laundry restoration', 'Assembly allowance to restore laundry including tub plumbing and splash lining', 'other', 'plumbing', 3800],
  ['ASM-KIT-BENCH-REP', 'Kitchen bench replace', 'Assembly allowance to replace kitchen benchtop splashback and reconnect plumbing', 'other', 'carpentry', 6200],
  ['ASM-KIT-CAB-REF', 'Kitchen cabinet refit', 'Assembly allowance to refit kitchen cabinets replace doors and hardware', 'other', 'carpentry', 7800],
  ['ASM-KIT-SPLASH', 'Kitchen splashback', 'Assembly allowance for tiled or glass kitchen splashback supply and install', 'other', 'carpentry', 2400],
  ['ASM-FLR-CARP-BED', 'Bedroom carpet replace', 'Assembly allowance to replace bedroom carpet including underlay and trim', 'other', 'general', 1900],
  ['ASM-FLR-CARP-LIV', 'Living carpet replace', 'Assembly allowance to replace living area carpet including underlay and trim', 'other', 'general', 3200],
  ['ASM-FLR-VINYL-WET', 'Wet area vinyl', 'Assembly allowance for wet area vinyl plank floor replacement', 'other', 'general', 2800],
  ['ASM-FLR-TILE-BATH', 'Bathroom floor tiles', 'Assembly allowance for bathroom floor tile replacement including prep', 'other', 'general', 3500],
  ['ASM-CEIL-SET-DOWN', 'Ceiling set down', 'Assembly allowance for ceiling set down after water damage including insulation', 'other', 'plastering', 4200],
  ['ASM-WALL-LINING-REP', 'Wall lining repair', 'Assembly allowance to replace wall linings in single room including paint', 'other', 'plastering', 3600],
  ['ASM-FIRE-SMOKE-ROOM', 'Smoke damage room', 'Assembly allowance for smoke damaged room clean seal and repaint', 'other', 'general', 4100],
  ['ASM-FIRE-KITCH', 'Kitchen fire damage', 'Assembly allowance for kitchen fire damage strip out and reinstatement', 'other', 'general', 12500],
  ['ASM-FLOOD-ROOM', 'Flood damage room', 'Assembly allowance for single room flood strip dry out and reinstate linings', 'other', 'general', 5800],
  ['ASM-FLOOD-WHOLE-L1', 'Ground floor flood', 'Assembly allowance for whole ground floor flood restoration excluding contents', 'other', 'general', 28000],
  ['ASM-MOULD-ROOM', 'Mould remediation room', 'Assembly allowance for mould remediation in single room with clearance test', 'other', 'general', 3200],
  ['ASM-MOULD-WET', 'Wet area mould treat', 'Assembly allowance for wet area mould treatment and membrane renewal', 'other', 'plumbing', 4500],
  ['ASM-STORM-ROOF-PATCH', 'Storm roof patch', 'Assembly allowance to patch storm damaged roof section and restore flashings', 'other', 'general', 2900],
  ['ASM-STORM-FENCE', 'Storm fence rebuild', 'Assembly allowance to rebuild storm damaged fence section per 10 metres', 'other', 'general', 2200],
  ['ASM-STORM-GUTTER', 'Gutter replacement', 'Assembly allowance to replace damaged gutter and downpipe run', 'other', 'general', 1650],
  ['ASM-ELE-REWIRE-CCT', 'Circuit rewire', 'Assembly allowance to rewire single damaged circuit including fittings', 'other', 'electrical', 1800],
  ['ASM-ELE-BOARD-UPG', 'Switchboard upgrade', 'Assembly allowance for switchboard upgrade with safety switches', 'other', 'electrical', 2400],
  ['ASM-ELE-SMOKE-UPG', 'Smoke alarm upgrade', 'Assembly allowance to upgrade smoke alarms to interconnected system', 'other', 'electrical', 680],
  ['ASM-PLU-HWS-REP', 'Hot water replace', 'Assembly allowance to replace hot water service including valves and compliance', 'other', 'plumbing', 2100],
  ['ASM-PLU-DRAIN-REP', 'Underground drain repair', 'Assembly allowance to excavate and repair underground sewer junction', 'other', 'plumbing', 3800],
  ['ASM-PLU-BURST-PIPE', 'Burst pipe make safe', 'Assembly allowance for burst pipe isolation repair and make safe', 'other', 'plumbing', 950],
  ['ASM-CAR-INT-DOOR', 'Internal door replace', 'Assembly allowance to replace internal door jamb architrave and hardware', 'other', 'carpentry', 780],
  ['ASM-CAR-WIN-LINING', 'Window lining replace', 'Assembly allowance to replace internal window lining and sill', 'other', 'carpentry', 620],
  ['ASM-CAR-FLOOR-JOIST', 'Floor joist repair', 'Assembly allowance to repair rotted floor joists and replace flooring', 'other', 'carpentry', 4500],
  ['ASM-CAR-DECK-SEC', 'Deck board replace', 'Assembly allowance to replace damaged deck boards and oil finish', 'other', 'carpentry', 2800],
  ['ASM-EXT-DRIVE-PATCH', 'Driveway patch', 'Assembly allowance to cut out and patch damaged driveway section', 'other', 'general', 2400],
  ['ASM-EXT-PATH-REP', 'Path reinstatement', 'Assembly allowance to reinstate concrete path after service trench', 'other', 'general', 1800],
  ['ASM-EXT-LANDSCAPE', 'Landscape restoration', 'Assembly allowance to restore landscaping disturbed by repair excavation', 'other', 'general', 1500],
  ['ASM-MAKE-SAFE', 'Emergency make safe', 'Assembly allowance for emergency make safe attendance and temporary weatherproofing', 'other', 'general', 1200],
  ['ASM-TEMP-FENCE', 'Temp fence package', 'Assembly allowance for temporary fencing around work area for four weeks', 'other', 'general', 980],
  ['ASM-CONTAINMENT', 'Containment setup', 'Assembly allowance to establish dust containment for occupied dwelling works', 'other', 'general', 850],
  ['ASM-PAINT-INT-ROOM', 'Interior room repaint', 'Assembly allowance to prep and repaint single standard bedroom', 'other', 'general', 1400],
  ['ASM-PAINT-INT-HOUSE', 'Whole house repaint', 'Assembly allowance to prep and repaint whole house interior three coat system', 'other', 'general', 9800],
  ['ASM-PAINT-EXT-FACADE', 'Exterior facade repaint', 'Assembly allowance to wash prep and repaint exterior facade elevation', 'other', 'general', 5600],
  ['ASM-INSULATION-CEIL', 'Ceiling insulation upgrade', 'Assembly allowance to upgrade ceiling insulation throughout dwelling', 'other', 'plastering', 3200],
  ['ASM-INSULATION-WALL', 'Wall insulation retrofit', 'Assembly allowance to retrofit wall insulation from internal lining removal', 'other', 'plastering', 4800],
  ['ASM-ROOF-SARKING', 'Roof sarking replace', 'Assembly allowance to replace damaged roof sarking and restore tiles', 'other', 'general', 5200],
  ['ASM-ROOF-FLASH', 'Roof flashing replace', 'Assembly allowance to replace roof flashings at wall and chimney junctions', 'other', 'general', 2100],
  ['ASM-BALUSTRADE', 'Balustrade replace', 'Assembly allowance to replace damaged timber or metal balustrade section', 'other', 'carpentry', 3400],
  ['ASM-GARAGE-DOOR', 'Garage door replace', 'Assembly allowance to supply and install sectional garage door', 'other', 'carpentry', 2800],
  ['ASM-SECURITY-DOOR', 'Security screen door', 'Assembly allowance to supply and install security screen door', 'other', 'carpentry', 890],
  ['ASM-EVACUATE-SERVICE', 'Evacuation service', 'Assembly allowance for tenant evacuation coordination during major works', 'other', 'general', 650],
  ['ASM-ACCESS-EQ', 'Access equipment pack', 'Assembly allowance for scaffold and access equipment on two storey repair', 'other', 'general', 1800],
  ['ASM-QA-HANDOVER', 'QA handover pack', 'Assembly allowance for final QA inspection and insurer handover documentation', 'other', 'general', 420],
  // Additional wet area assemblies
  ['ASM-WET-ENSUITE-REL', 'Ensuite relining', 'Assembly allowance for ensuite relining including waterproofing and tiling to wet zone', 'other', 'plumbing', 6800],
  ['ASM-WET-POWDER-ROOM', 'Powder room refit', 'Assembly allowance to refit powder room vanity toilet and wall lining', 'other', 'plumbing', 2600],
  ['ASM-WET-BATH-REGROUT', 'Bathroom regrout', 'Assembly allowance to strip and regrout bathroom wall and floor tiles', 'other', 'plumbing', 1350],
  ['ASM-WET-SHOWER-SCREEN', 'Shower screen replace', 'Assembly allowance to replace shower screen and reseal recess perimeter', 'other', 'plumbing', 980],
  ['ASM-WET-TAPWARE-UPG', 'Tapware upgrade', 'Assembly allowance to upgrade bathroom tapware and fittings throughout wet area', 'other', 'plumbing', 1650],
  // Additional kitchen assemblies
  ['ASM-KIT-APPLIANCE-RECONNECT', 'Kitchen appliance reconnect', 'Assembly allowance to reconnect kitchen appliances after fire or flood repair', 'other', 'plumbing', 780],
  ['ASM-KIT-PANTRY-REBUILD', 'Pantry rebuild', 'Assembly allowance to rebuild pantry shelving and lining after damage', 'other', 'carpentry', 2100],
  ['ASM-KIT-ISLAND-BENCH', 'Kitchen island bench', 'Assembly allowance to replace kitchen island bench structure and benchtop', 'other', 'carpentry', 5400],
  ['ASM-KIT-SPLASH-GLASS', 'Glass splashback', 'Assembly allowance for toughened glass kitchen splashback supply and install', 'other', 'carpentry', 1950],
  // Additional flood assemblies
  ['ASM-FLOOD-SUBFLOOR', 'Subfloor flood dry-out', 'Assembly allowance for subfloor timber flood dry-out and mould treatment', 'other', 'general', 3600],
  ['ASM-FLOOD-GARAGE', 'Garage flood restore', 'Assembly allowance for garage flood strip clean and reinstate linings', 'other', 'general', 3900],
  ['ASM-FLOOD-CONTENTS-DRY', 'Contents drying service', 'Assembly allowance for contents drying and dehumidification service on-site', 'other', 'general', 1450],
  // Additional fire assemblies
  ['ASM-FIRE-CEILING', 'Fire damaged ceiling', 'Assembly allowance to remove and replace fire damaged ceiling lining', 'other', 'plastering', 4600],
  ['ASM-FIRE-ELECTRICAL-RESTORE', 'Fire electrical restore', 'Assembly allowance to restore electrical circuits damaged by fire', 'other', 'electrical', 3100],
  ['ASM-FIRE-STRUCTURAL-CLEAN', 'Fire structural clean', 'Assembly allowance for structural timber soot clean and seal after fire', 'other', 'general', 2750],
  // Additional storm assemblies
  ['ASM-STORM-WINDOW-BOARDUP', 'Storm window board-up', 'Assembly allowance to board up and later replace storm damaged windows', 'other', 'carpentry', 1200],
  ['ASM-STORM-TREE-DAMAGE', 'Storm tree damage repair', 'Assembly allowance to remove fallen tree and repair structural damage', 'other', 'general', 6200],
  ['ASM-STORM-CARPORT', 'Carport storm repair', 'Assembly allowance to repair storm damaged carport roof and posts', 'other', 'carpentry', 3400],
  // Additional electrical assemblies
  ['ASM-ELE-DOWNLIGHT-UPG', 'Downlight upgrade', 'Assembly allowance to upgrade downlights throughout dwelling to LED', 'other', 'electrical', 1900],
  ['ASM-ELE-SOLAR-RECONNECT', 'Solar reconnect', 'Assembly allowance to isolate and reconnect rooftop solar after roof repair', 'other', 'electrical', 1100],
  ['ASM-ELE-DATA-REWIRE', 'Data network rewire', 'Assembly allowance to rewire data and network points throughout dwelling', 'other', 'electrical', 1400],
  // Additional plumbing assemblies
  ['ASM-PLU-GAS-RECONNECT', 'Gas reconnect', 'Assembly allowance to make safe and reconnect gas appliances after repair', 'other', 'plumbing', 890],
  ['ASM-PLU-STORMWATER-REP', 'Stormwater repair', 'Assembly allowance to excavate and repair damaged stormwater line', 'other', 'plumbing', 2600],
  ['ASM-PLU-TAPWARE-REP', 'Tapware replace pack', 'Assembly allowance to replace all tapware in kitchen and bathrooms', 'other', 'plumbing', 1750],
  // Additional plastering assemblies
  ['ASM-PLS-CORNICE-FULL', 'Full cornice replace', 'Assembly allowance to strip and replace cornice throughout single level', 'other', 'plastering', 2900],
  ['ASM-PLS-BULKHEAD-BUILD', 'Bulkhead construction', 'Assembly allowance to construct plasterboard bulkhead for services concealment', 'other', 'plastering', 1650],
  ['ASM-PLS-CEILING-PATCH', 'Ceiling patch repair', 'Assembly allowance to patch and texture match damaged ceiling section', 'other', 'plastering', 980],
  // Additional carpentry assemblies
  ['ASM-CAR-PERGOLA-REPAIR', 'Pergola repair', 'Assembly allowance to repair storm or fire damaged pergola structure', 'other', 'carpentry', 2400],
  ['ASM-CAR-STAIR-REBUILD', 'Staircase rebuild', 'Assembly allowance to rebuild internal timber staircase and balustrade', 'other', 'carpentry', 6800],
  ['ASM-CAR-WARDROBE-FITOUT', 'Wardrobe fit-out', 'Assembly allowance to replace built-in wardrobe fit-out after water damage', 'other', 'carpentry', 2200],
  // Additional painting assemblies
  ['ASM-PAINT-CEILING-ONLY', 'Ceiling repaint only', 'Assembly allowance to prep and repaint ceilings only throughout single level', 'other', 'general', 2600],
  ['ASM-PAINT-TRIM-DOORS', 'Trim and doors repaint', 'Assembly allowance to prep and repaint skirting architraves and doors', 'other', 'general', 1800],
  ['ASM-PAINT-GARAGE-FLOOR', 'Garage floor coating', 'Assembly allowance to prep and apply epoxy coating to garage floor', 'other', 'general', 1500],
  // Additional flooring assemblies
  ['ASM-FLR-TIMBER-SAND-POLISH', 'Timber floor sand & polish', 'Assembly allowance to sand and polish existing timber floor after damage', 'other', 'general', 3800],
  ['ASM-FLR-LAMINATE-LIVING', 'Laminate flooring living', 'Assembly allowance to install laminate flooring in living areas', 'other', 'general', 2900],
  ['ASM-FLR-TILE-ENTRY', 'Entry tile replace', 'Assembly allowance to replace entry and hallway floor tiles', 'other', 'general', 2100],
  // Additional make-safe assemblies
  ['ASM-MAKE-SAFE-ROOF-TARP', 'Emergency roof tarping', 'Assembly allowance for emergency tarping of storm or fire damaged roof', 'other', 'general', 950],
  ['ASM-MAKE-SAFE-BOARDUP', 'Emergency board-up', 'Assembly allowance for emergency board-up of damaged openings and access points', 'other', 'carpentry', 850],
  ['ASM-MAKE-SAFE-POWER-ISOLATE', 'Emergency power isolation', 'Assembly allowance for emergency electrical isolation and temporary supply', 'other', 'electrical', 620],
];

for (const [code, display, desc, type, category, fixed] of assemblies) {
  addAssembly({ code, display, desc, type, category, fixed });
}

// ── Internal computed-pricing BOM ────────────────────────────────────────────
// For each assembly, derive a deterministic bill of materials referencing real
// primitive codes so downstream "computed" pricing can roll up assembly cost
// from its components. Selection is seeded per assembly code for reproducible
// output across regenerations.

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}

function seededRng(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poolItemsFor(type, category) {
  const byCategory = pools[type];
  return byCategory[category] ?? byCategory.general ?? [];
}

/** Prefer curated `named` primitives; only fall back to filler codes if a
 * category/type pool has no curated entries. */
function namedPoolItemsFor(type, category) {
  const all = poolItemsFor(type, category);
  const named = all.filter((item) => item.named);
  return named.length ? named : all;
}

function buildComponents(asm, rng) {
  const category = asm.category;
  const materialPool = namedPoolItemsFor('material', category);
  const labourPool = namedPoolItemsFor('labour', category);
  const equipmentPool = namedPoolItemsFor('equipment', category);
  const vendorPool = namedPoolItemsFor('vendor', category);
  const otherPool = namedPoolItemsFor('other', category);

  const pick = (pool) => pool[Math.floor(rng() * pool.length)];

  const componentCount = 3 + Math.floor(rng() * 6); // 3..8
  const chosen = new Map();

  const addComponent = (item) => {
    if (!item || chosen.has(item.code)) return false;
    let quantity;
    let wasteFactor = 1;
    if (item.type === 'material') {
      quantity = 1 + Math.floor(rng() * 20);
      wasteFactor = Number((1.05 + rng() * 0.1).toFixed(2));
    } else if (item.type === 'labour') {
      quantity = 1 + Math.floor(rng() * 16);
    } else if (item.type === 'equipment') {
      quantity = 1 + Math.floor(rng() * 3);
    } else {
      quantity = 1;
    }
    chosen.set(item.code, { code: item.code, quantity, wasteFactor });
    return true;
  };

  if (materialPool.length) addComponent(pick(materialPool));
  if (labourPool.length) addComponent(pick(labourPool));

  const combinedPools = [materialPool, materialPool, labourPool, equipmentPool, vendorPool, otherPool].filter(
    (pool) => pool.length,
  );

  let guard = 0;
  while (chosen.size < componentCount && guard < 200) {
    guard++;
    const pool = combinedPools[Math.floor(rng() * combinedPools.length)];
    if (!pool) continue;
    addComponent(pick(pool));
  }

  return Array.from(chosen.values());
}

const bom = assemblyDefs.map((asm) => {
  const rng = seededRng(hashCode(asm.code));
  return {
    code: asm.code,
    name: asm.display,
    description: asm.desc,
    typeCode: asm.type,
    categoryCode: asm.category,
    pricingMode: 'computed',
    components: buildComponents(asm, rng),
  };
});

// ── Validate BOM references ─────────────────────────────────────────────────

const primitiveCodes = new Set(primitives.map((p) => p.code));
const missing = [];
for (const entry of bom) {
  for (const component of entry.components) {
    if (!primitiveCodes.has(component.code)) missing.push(`${entry.code} -> ${component.code}`);
  }
}
if (missing.length) {
  throw new Error(`BOM references unknown primitive codes:\n${missing.join('\n')}`);
}

// ── Write CSV output ─────────────────────────────────────────────────────────

const allItems = [...primitives, ...assemblyDefs];
const csvLines = [HEADER.join(','), ...allItems.map(toCsvRow)];
writeFileSync(CSV_OUT, csvLines.join('\n') + '\n', 'utf8');

// ── Write BOM output ─────────────────────────────────────────────────────────

writeFileSync(BOM_OUT, JSON.stringify(bom, null, 2) + '\n', 'utf8');

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`Wrote ${allItems.length} items to ${CSV_OUT}`);
console.log(`  Primitives: ${primitives.length}`);
console.log(`  Assemblies: ${assemblyDefs.length}`);
console.log(`Wrote ${bom.length} BOM entries to ${BOM_OUT}`);

/**
 * 8 Box — shared schema, defaults, coercion, and validation.
 *
 * The F3 "8-Block" vision board: eight fixed boxes a PAX fills in for himself
 * and shares with his shield lock, plus a single "Word for the Box" — the
 * ethos, written in the middle of the page. Content is persisted as one JSON
 * string in `paxVault.pv_pax_eight_box.json_content`. Keeping the shape here,
 * free of server-only imports, lets the BigQuery layer, the API routes, the
 * client form, and the board renderer all agree on one definition.
 *
 * ── The spec drives everything ──────────────────────────────────────────────
 * `EIGHT_BOX_DEFINITIONS` declares each box's sub-fields (single-line or
 * multi-line text) and, where a box is a list (1st F goals, 2nd F men, the
 * Jesters), the fields of each list item. Coercion, validation, the editor,
 * and the board render generically from that spec, so adding a sub-field is
 * a one-line change here.
 *
 * Every box also carries a `notes` field. Besides "anything else", it is
 * where a version-1 board (one free-text blob per box) lands when read back.
 *
 * Lifecycle (see `lib/bq/eightBox.ts`): a PAX has at most one editable
 * `draft`; publishing freezes it as an immutable `published` version with a
 * per-PAX sequence number. Published versions are never edited, only deleted.
 */

/** Schema version stamped into every write. Bump when a migration is needed. */
export const EIGHT_BOX_VERSION = 2;

/** Limits by field kind (enforced on write, truncated on read). */
export const EIGHT_BOX_SHORT_MAX = 80;
export const EIGHT_BOX_TEXT_MAX = 400;
export const EIGHT_BOX_NOTES_MAX = 600;
export const EIGHT_BOX_WORD_MAX = 40;

/** Limit for the free-text period label, e.g. "2026-Q3". */
export const EIGHT_BOX_PERIOD_MAX_CHARS = 32;

/** Info-icon copy for the two top-level fields. */
export const EIGHT_BOX_WORD_HELP =
  "One word that captures how you want to show up this quarter. It goes in the middle of the board so you see it every time you look at it.";
export const EIGHT_BOX_PERIOD_HELP =
  'A label for this version — the current quarter by default. Change it if you run your 8 Box on a different rhythm, e.g. "2026 H1" or "Lent 2026".';

export const EIGHT_BOX_KEYS = [
  "concentrica",
  "firstF",
  "secondF",
  "thirdF",
  "jester",
  "mentalSharpness",
  "dateNight",
  "alr",
] as const;

export type EightBoxKey = (typeof EIGHT_BOX_KEYS)[number];

export type EightBoxStatus = "draft" | "published";

export interface EightBoxFieldSpec {
  key: string;
  /** Label on the form and the board. */
  label: string;
  /** `short` renders a single-line input; `text` a textarea. */
  kind: "short" | "text";
  /** Placeholder / hint in the editor. */
  prompt?: string;
  /** Character limit; defaults by kind. */
  max?: number;
  /** Longer explanation shown behind the info icon while filling it out. */
  help?: string;
}

export interface EightBoxListSpec {
  key: string;
  /** Heading for the list on the form and the board. */
  label: string;
  itemFields: EightBoxFieldSpec[];
  /** Maximum items persisted. */
  max: number;
  /** Rows always shown in the editor (a fixed list shows exactly this many). */
  rows: number;
  /** True: exactly `rows` slots, no add/remove. */
  fixed?: boolean;
  addLabel?: string;
}

export interface EightBoxDefinition {
  key: EightBoxKey;
  /** Box heading as shown on the board. */
  title: string;
  /** One-line gloss under the heading. */
  subtitle: string;
  /** The Q Source guidance, condensed, shown in the editor. */
  guidance: string;
  /** Scalar sub-fields, in display order. `notes` must be last. */
  fields: EightBoxFieldSpec[];
  /** Optional list section, rendered before the scalar fields. */
  list?: EightBoxListSpec;
}

const NOTES: EightBoxFieldSpec = {
  key: "notes",
  label: "Notes",
  kind: "text",
  prompt: "Anything else for this box.",
  max: EIGHT_BOX_NOTES_MAX,
  help: "Anything that does not fit the fields above — context, a reminder, a quote that landed. Optional.",
};

/** The standard F3 8-Block, in board (reading) order. */
export const EIGHT_BOX_DEFINITIONS: readonly EightBoxDefinition[] = [
  {
    key: "concentrica",
    title: "Concentrica",
    subtitle: "The five rings — who is most important in your life",
    guidance:
      "Think of a five-ring target: your M at the center, then your 2.0s, your Shield Lock, your Blade, and Mammon (the world — work, money, everything else). Name who is in each ring. If you see a gap that is affecting a relationship, write it down and be intentional about closing it.",
    fields: [
      {
        key: "m",
        label: "M (center ring)",
        kind: "text",
        prompt: "Your M — and any gap you need to close.",
        help: "The center of the target. Name your M, then be honest about any gap: the thing she keeps asking for, the pattern you keep repeating. The gap is the work.",
      },
      {
        key: "twoPointOh",
        label: "2.0s",
        kind: "text",
        prompt: "Each 2.0 by name — and what each one needs from you.",
        help: "Second ring. Each 2.0 by name, and what each one needs from you right now — it is different for a 6-year-old and a 16-year-old.",
      },
      {
        key: "shieldLock",
        label: "Shield Lock",
        kind: "text",
        prompt: "The men who lock shields with you.",
        help: "Third ring: the 3–5 men who hold you accountable and whom you hold accountable. If you don't have one yet, write who it could be.",
      },
      {
        key: "blade",
        label: "Blade",
        kind: "text",
        prompt:
          "Close friends, family, the men you sharpen and who sharpen you.",
        help: "Fourth ring: the close friends and family beyond your Shield Lock — the people who sharpen you and whom you sharpen.",
      },
      {
        key: "mammon",
        label: "Mammon",
        kind: "text",
        prompt:
          "Work, money, the world — where does it sit, and is it in its lane?",
        help: "Outer ring: work, money, possessions, the world's demands. It belongs on the target, but in the outer ring. Note where it has crept inward.",
      },
      NOTES,
    ],
  },
  {
    key: "firstF",
    title: "1st F — Fitness",
    subtitle: "Goals you will write down and track",
    guidance:
      "If it is worth doing, it is worth tracking — and by tracking it you will almost certainly get better. Set goals for the year and take them in quarterly or monthly blocks. Some men pull their family or Shield Lock into these goals.",
    list: {
      key: "goals",
      label: "Goals",
      max: 6,
      rows: 2,
      addLabel: "Add goal",
      itemFields: [
        {
          key: "goal",
          label: "Goal",
          kind: "short",
          prompt: "1,000 miles this year · Q once a week · 150 posts",
          help: "One measurable thing: miles, posts, Qs, a race. Something you can count, not 'get in shape'.",
        },
        {
          key: "target",
          label: "Target",
          kind: "short",
          prompt: "1,000 mi",
          help: "The number or finish line you are aiming at for the year (or the quarter, if you break it up).",
        },
        {
          key: "progress",
          label: "So far",
          kind: "short",
          prompt: "0",
          help: "Where you are right now. Update it each time you publish, so your history shows the trend.",
        },
      ],
    },
    fields: [
      {
        key: "csaups",
        label: "CSAUPs & events on the calendar",
        kind: "text",
        prompt:
          "Mortimer, GrowRuck, BRR, a 5K building to a marathon, Iron Man, Spartan, the Leadership Challenge…",
        help: "Completely Stupid And Utterly Pointless events: Mortimer, GrowRuck, BRR, a marathon, an Iron Man, the Leadership Challenge. Put dates on the calendar — a date makes it real.",
      },
      {
        key: "ehKotter",
        label: "EH / Kotter goal",
        kind: "text",
        prompt:
          "How many FNGs will you EH, and how many Kotters will you bring back? One a quarter? One a month? Track it here.",
        help: "EH (Emotional Headlock): the men you will invite to their first post. Kotters: the men who drifted and need a text. Set a number and track it like any other goal.",
      },
      NOTES,
    ],
  },
  {
    key: "secondF",
    title: "2nd F — Fellowship",
    subtitle: "Three men who need more of your time",
    guidance:
      "List three men you need to spend extra time with — by name. They do not have to be F3 men. They are probably unique to you: men for whom you have some work to do to be the friend they need.",
    list: {
      key: "men",
      label: "The three",
      max: 3,
      rows: 3,
      fixed: true,
      itemFields: [
        {
          key: "name",
          label: "Name",
          kind: "short",
          prompt: "F3 name or real name",
          help: "A real person, by name — not a category. He does not have to be an F3 man.",
        },
        {
          key: "plan",
          label: "What he needs from you",
          kind: "text",
          prompt: "Coffee every other week · post together Fridays · call him.",
          help: "The specific thing you owe him: a call, a standing coffee, posting together, showing up to his thing.",
        },
      ],
    },
    fields: [NOTES],
  },
  {
    key: "thirdF",
    title: "3rd F — Faith",
    subtitle: "Faith and service — specific plans, written down",
    guidance:
      'Easy to plan, toughest to follow through. Be specific: "I\'m going to read the Bible more" does not count — which books, which study? Write it out, share it with your Concentrica so they can hold you accountable, then do it.',
    fields: [
      {
        key: "study",
        label: "What you are studying",
        kind: "text",
        prompt:
          "The Gospel of John with the Thursday group · Q Source, one Q a week…",
        help: "Name the book, the passage, the curriculum, the group. 'Read more' is not a plan; 'Romans, one chapter a week with the Thursday group' is.",
      },
      {
        key: "service",
        label: "Where you are serving",
        kind: "text",
        prompt:
          "Church · a local nonprofit · a community project — and how often.",
        help: "Where you give time, not just money: church, a nonprofit, a neighbor. Say how often.",
      },
      {
        key: "other",
        label: "Other faith goals",
        kind: "text",
        prompt: "Prayer, a group, a retreat, a habit.",
        help: "Prayer habits, a retreat, a men's group, a conversation you have been avoiding — any other faith goal for the quarter.",
      },
      NOTES,
    ],
  },
  {
    key: "jester",
    title: "Jester",
    subtitle: "What is holding you back from being the best you can be",
    guidance:
      "Tougher than it sounds if you have never considered it. Read about the Jester in Q Source and Freed to Lead, then talk it through in the gloom with a brother you are close to — a Shield Lock or Whetstone brother if you have one. It takes thought up front and thick skin. You may have more than one.",
    list: {
      key: "jesters",
      label: "Your Jester(s)",
      max: 4,
      rows: 1,
      addLabel: "Add another Jester",
      itemFields: [
        {
          key: "what",
          label: "What is holding you back",
          kind: "text",
          prompt: "The habit, the fear, the excuse, the distraction — name it.",
          help: "The voice that tells you to stay small: the snooze button, the drink, the phone, the fear of looking foolish, the grudge. Name it plainly.",
        },
        {
          key: "answer",
          label: "How you will answer it",
          kind: "text",
          prompt: "The concrete move that shuts the Jester up.",
          help: "The concrete move that beats it: alarm across the room, phone in the kitchen at 9, the call you make first. Vague intentions lose to the Jester every time.",
        },
      ],
    },
    fields: [
      {
        key: "discussWith",
        label: "Who you will talk it through with",
        kind: "short",
        prompt: "A Shield Lock or Whetstone brother",
        help: "A brother you will actually say this out loud to: Shield Lock, Whetstone, or a man you trust in the gloom. Naming him here is the commitment.",
      },
      NOTES,
    ],
  },
  {
    key: "mentalSharpness",
    title: "Mental Sharpness",
    subtitle: "What you are doing to mentally accelerate",
    guidance:
      "What are you reading and listening to that makes you better? Do you get home and sit in front of the TV until your M drags you to bed? Have a little purpose and a plan that keeps you mentally in the game.",
    fields: [
      {
        key: "reading",
        label: "Reading",
        kind: "text",
        prompt: "Books on the list this quarter.",
        help: "Titles for this quarter, not 'read more'. One good book finished beats ten started.",
      },
      {
        key: "listening",
        label: "Listening / watching",
        kind: "text",
        prompt: "Podcasts, courses, teaching — the good stuff, not the noise.",
        help: "Podcasts, courses, sermons, audiobooks — the inputs that make you sharper, not the noise that fills the drive.",
      },
      {
        key: "plan",
        label: "The plan instead of the couch",
        kind: "text",
        prompt: "What the evenings look like on purpose.",
        help: "What the evenings look like on purpose. If the default is the couch and the remote, write down what replaces it.",
      },
      NOTES,
    ],
  },
  {
    key: "dateNight",
    title: "Date Night",
    subtitle: "Your M and your 2.0s",
    guidance:
      "Never stop dating your M. And date your 2.0s: show them how they should treat, and be treated by, any future mate. Keep in mind where each of them lives in your Concentrica.",
    fields: [
      {
        key: "m",
        label: "Dating your M",
        kind: "text",
        prompt:
          "A standing date night · a trip · the thing she has been asking for.",
        help: "A standing date night is the floor. Add the trip, the thing she has mentioned twice, the surprise. Be specific about when.",
      },
      {
        key: "twoPointOh",
        label: "Dating your 2.0s",
        kind: "text",
        prompt: "One-on-one time with each 2.0 — what and how often.",
        help: "One-on-one time with each 2.0, by name. Show them how they should treat, and be treated by, a future mate.",
      },
      NOTES,
    ],
  },
  {
    key: "alr",
    title: "ALR — Ask, Listen, Remember",
    subtitle: "The advice area — find a mentor",
    guidance:
      "Find someone who knows more about something than you do and learn from him. In other words, find a mentor. A great Whetstone opportunity.",
    fields: [
      {
        key: "mentor",
        label: "Who you will learn from",
        kind: "short",
        prompt: "Name him.",
        help: "A man who knows more than you about something that matters to you. Ask him — most men say yes and are honored to be asked.",
      },
      {
        key: "learning",
        label: "What you want to learn",
        kind: "text",
        prompt: "Fatherhood, a trade, faith, leading a region, money…",
        help: "The specific area: fatherhood, a trade, faith, money, leading a region. Narrow enough that the conversations have a point.",
      },
      {
        key: "cadence",
        label: "How and how often",
        kind: "short",
        prompt:
          "Coffee monthly · a Whetstone pairing · post-beatdown coffeeteria",
        help: "How and how often you will meet: monthly coffee, a Whetstone pairing, coffeeteria after the beatdown. A cadence is what makes it happen.",
      },
      NOTES,
    ],
  },
];

export type EightBoxItem = Record<string, string>;

export interface EightBoxValues {
  fields: Record<string, string>;
  items: EightBoxItem[];
}

export interface EightBoxContent {
  /** Schema version of the stored content; lets future migrations branch. */
  version: number;
  /** "Word for the Box" — the ethos, written in the middle of the page. */
  word: string;
  boxes: Record<EightBoxKey, EightBoxValues>;
}

export function fieldMax(field: EightBoxFieldSpec): number {
  if (field.max) return field.max;
  return field.kind === "short" ? EIGHT_BOX_SHORT_MAX : EIGHT_BOX_TEXT_MAX;
}

function emptyValues(def: EightBoxDefinition): EightBoxValues {
  return {
    fields: Object.fromEntries(def.fields.map((f) => [f.key, ""])),
    items: [],
  };
}

/** An empty list item for a box's list, every item field blank. */
export function emptyItem(list: EightBoxListSpec): EightBoxItem {
  return Object.fromEntries(list.itemFields.map((f) => [f.key, ""]));
}

function emptyBoxes(): Record<EightBoxKey, EightBoxValues> {
  return Object.fromEntries(
    EIGHT_BOX_DEFINITIONS.map((d) => [d.key, emptyValues(d)]),
  ) as Record<EightBoxKey, EightBoxValues>;
}

/** Fresh copy of the empty board (callers mutate drafts, so never share). */
export function emptyEightBox(): EightBoxContent {
  return { version: EIGHT_BOX_VERSION, word: "", boxes: emptyBoxes() };
}

/** "2026-Q3" for any date in Jul–Sep 2026. Uses the local calendar. */
export function currentQuarterLabel(date: Date = new Date()): string {
  const quarter = Math.floor(date.getMonth() / 3) + 1;
  return `${date.getFullYear()}-Q${quarter}`;
}

// C0 control characters other than tab (0x09) and newline (0x0A), plus DEL.
// Built from char codes so the source file itself never contains raw bytes.
const ctrl = (code: number) => String.fromCharCode(code);
const CONTROL_CHARS = new RegExp(
  `[${ctrl(0)}-${ctrl(8)}${ctrl(11)}-${ctrl(31)}${ctrl(127)}]`,
  "g",
);

/**
 * Normalize untrusted text: non-strings become "", line endings become LF,
 * control characters are stripped, surrounding whitespace is trimmed.
 * Does NOT enforce a length limit — the read and write paths differ there.
 */
export function normalizeBoxText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").replace(CONTROL_CHARS, "").trim();
}

/** Single-line variant: newlines collapse to a space. */
function normalizeShort(value: unknown): string {
  return normalizeBoxText(value).replace(/\s*\n\s*/g, " ");
}

function normalizeField(field: EightBoxFieldSpec, value: unknown): string {
  return field.kind === "short"
    ? normalizeShort(value)
    : normalizeBoxText(value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function itemIsBlank(item: EightBoxItem): boolean {
  return Object.values(item).every((v) => !v);
}

/**
 * Walk one box's untrusted input against its spec.
 *
 * `onViolation` is called with a human label when a value exceeds its limit
 * (the write path rejects; the read path truncates and never calls it).
 */
function readBox(
  def: EightBoxDefinition,
  raw: unknown,
  mode: "read" | "write",
  onViolation?: (message: string) => void,
): EightBoxValues {
  const out = emptyValues(def);

  // Version-1 rows stored one free-text string per box: keep it as notes.
  if (typeof raw === "string") {
    out.fields.notes = normalizeBoxText(raw).slice(0, EIGHT_BOX_NOTES_MAX);
    return out;
  }
  if (!isObject(raw)) return out;

  const rawFields = isObject(raw.fields) ? raw.fields : {};
  for (const field of def.fields) {
    let text = normalizeField(field, rawFields[field.key]);
    const max = fieldMax(field);
    if (text.length > max) {
      if (mode === "write") {
        onViolation?.(
          `"${def.title} › ${field.label}" is too long (max ${max} characters).`,
        );
      }
      text = text.slice(0, max);
    }
    out.fields[field.key] = text;
  }

  if (def.list) {
    const list = def.list;
    const rawItems = Array.isArray(raw.items) ? raw.items : [];
    const items: EightBoxItem[] = [];
    for (const rawItem of rawItems) {
      if (!isObject(rawItem)) continue;
      const item = emptyItem(list);
      for (const field of list.itemFields) {
        let text = normalizeField(field, rawItem[field.key]);
        const max = fieldMax(field);
        if (text.length > max) {
          if (mode === "write") {
            onViolation?.(
              `"${def.title} › ${list.label} › ${field.label}" is too long (max ${max} characters).`,
            );
          }
          text = text.slice(0, max);
        }
        item[field.key] = text;
      }
      // Blank rows are editor scaffolding, never data.
      if (!itemIsBlank(item)) items.push(item);
    }
    if (items.length > list.max && mode === "write") {
      onViolation?.(
        `"${def.title} › ${list.label}" has too many entries (max ${list.max}).`,
      );
    }
    out.items = items.slice(0, list.max);
  }

  return out;
}

/**
 * Narrow an untrusted value (a parsed `json_content`, or an API request body)
 * into a fully-populated board.
 *
 * Never throws. Unknown keys are dropped, missing fields default to "", and
 * over-long text is truncated — this is the READ path, so a stored row that
 * predates a tighter limit still renders rather than breaking the page.
 * Version-1 rows (one string per box) are migrated into each box's notes.
 */
export function coerceEightBoxContent(input: unknown): EightBoxContent {
  if (!isObject(input)) return emptyEightBox();

  const rawBoxes = isObject(input.boxes) ? input.boxes : {};
  const boxes = emptyBoxes();
  for (const def of EIGHT_BOX_DEFINITIONS) {
    boxes[def.key] = readBox(def, rawBoxes[def.key], "read");
  }

  return {
    version:
      typeof input.version === "number" && Number.isFinite(input.version)
        ? input.version
        : EIGHT_BOX_VERSION,
    word: normalizeShort(input.word).slice(0, EIGHT_BOX_WORD_MAX),
    boxes,
  };
}

/**
 * Parse a stored `json_content` string. Invalid JSON degrades to an empty
 * board rather than throwing.
 */
export function parseEightBoxContent(
  raw: string | null | undefined,
): EightBoxContent {
  if (!raw) return emptyEightBox();
  try {
    return coerceEightBoxContent(JSON.parse(raw));
  } catch {
    return emptyEightBox();
  }
}

/**
 * Serialize for storage. Always stamps the current schema version so the
 * persisted row records the shape it was written with.
 */
export function serializeEightBoxContent(content: EightBoxContent): string {
  return JSON.stringify({
    version: EIGHT_BOX_VERSION,
    word: content.word,
    boxes: content.boxes,
  });
}

/** True when one box has nothing in it. */
export function isBoxBlank(values: EightBoxValues): boolean {
  return (
    Object.values(values.fields).every((v) => !v) &&
    values.items.every(itemIsBlank)
  );
}

/** True when the whole board is empty (word included). */
export function isEightBoxBlank(content: EightBoxContent): boolean {
  return (
    !content.word &&
    EIGHT_BOX_KEYS.every((key) => isBoxBlank(content.boxes[key]))
  );
}

export type EightBoxValidation =
  | { ok: true; content: EightBoxContent; period: string }
  | { ok: false; error: string };

/**
 * Validate an API request body for a draft save or a publish.
 *
 * This is the WRITE path, so it rejects rather than silently truncating: the
 * form already enforces these limits, and a violation means a misbehaving
 * client, not a user who deserves to have their text quietly cut. Unknown
 * keys are dropped. An all-blank board is allowed for drafts (`requireContent`
 * false) but not for publishing.
 */
export function validateEightBoxSubmission(
  body: unknown,
  options: { requireContent: boolean },
): EightBoxValidation {
  if (!isObject(body)) {
    return { ok: false, error: "Request body must be an object." };
  }

  let violation: string | null = null;
  const note = (message: string) => {
    if (!violation) violation = message;
  };

  const word = normalizeShort(body.word);
  if (word.length > EIGHT_BOX_WORD_MAX) {
    note(
      `"Word for the Box" is too long (max ${EIGHT_BOX_WORD_MAX} characters).`,
    );
  }

  const rawBoxes = isObject(body.boxes) ? body.boxes : {};
  const boxes = emptyBoxes();
  for (const def of EIGHT_BOX_DEFINITIONS) {
    boxes[def.key] = readBox(def, rawBoxes[def.key], "write", note);
  }
  if (violation) return { ok: false, error: violation };

  const content: EightBoxContent = {
    version: EIGHT_BOX_VERSION,
    word,
    boxes,
  };

  if (options.requireContent && isEightBoxBlank(content)) {
    return {
      ok: false,
      error: "Fill in at least one box before publishing.",
    };
  }

  const period =
    body.period === undefined || body.period === null
      ? currentQuarterLabel()
      : normalizeShort(body.period);

  if (!period) {
    return { ok: false, error: "Period is required." };
  }
  if (period.length > EIGHT_BOX_PERIOD_MAX_CHARS) {
    return {
      ok: false,
      error: `Period is too long (max ${EIGHT_BOX_PERIOD_MAX_CHARS} characters).`,
    };
  }

  return { ok: true, content, period };
}

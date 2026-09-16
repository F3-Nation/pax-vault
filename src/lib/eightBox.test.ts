import { describe, it, expect } from "vitest";
import {
  EIGHT_BOX_DEFINITIONS,
  EIGHT_BOX_KEYS,
  EIGHT_BOX_NOTES_MAX,
  EIGHT_BOX_PERIOD_HELP,
  EIGHT_BOX_PERIOD_MAX_CHARS,
  EIGHT_BOX_SHORT_MAX,
  EIGHT_BOX_TEXT_MAX,
  EIGHT_BOX_VERSION,
  EIGHT_BOX_WORD_HELP,
  EIGHT_BOX_WORD_MAX,
  coerceEightBoxContent,
  currentQuarterLabel,
  emptyEightBox,
  isEightBoxBlank,
  normalizeBoxText,
  parseEightBoxContent,
  serializeEightBoxContent,
  validateEightBoxSubmission,
} from "./eightBox";

describe("EIGHT_BOX_DEFINITIONS", () => {
  it("defines the eight boxes once each, in key order", () => {
    expect(EIGHT_BOX_DEFINITIONS).toHaveLength(8);
    expect(EIGHT_BOX_DEFINITIONS.map((d) => d.key)).toEqual([
      ...EIGHT_BOX_KEYS,
    ]);
    expect(new Set(EIGHT_BOX_KEYS).size).toBe(8);
  });

  it("gives every box a trailing notes field and unique sub-field keys", () => {
    for (const def of EIGHT_BOX_DEFINITIONS) {
      expect(def.fields[def.fields.length - 1].key).toBe("notes");
      const keys = def.fields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      if (def.list) {
        const itemKeys = def.list.itemFields.map((f) => f.key);
        expect(new Set(itemKeys).size).toBe(itemKeys.length);
        expect(def.list.rows).toBeLessThanOrEqual(def.list.max);
      }
    }
  });

  it("gives every field, item field, and top-level input an info-icon explanation", () => {
    expect(EIGHT_BOX_WORD_HELP.length).toBeGreaterThan(20);
    expect(EIGHT_BOX_PERIOD_HELP.length).toBeGreaterThan(20);
    for (const def of EIGHT_BOX_DEFINITIONS) {
      for (const f of def.fields) {
        expect(f.help, `${def.key}.${f.key}`).toBeTruthy();
      }
      for (const f of def.list?.itemFields ?? []) {
        expect(f.help, `${def.key}.items.${f.key}`).toBeTruthy();
      }
    }
  });

  it("models the guidance: five rings, three men, trackable goals, many jesters", () => {
    const by = (k: string) => EIGHT_BOX_DEFINITIONS.find((d) => d.key === k)!;
    expect(by("concentrica").fields.map((f) => f.key)).toEqual([
      "m",
      "twoPointOh",
      "shieldLock",
      "blade",
      "mammon",
      "notes",
    ]);
    expect(by("secondF").list).toMatchObject({ max: 3, rows: 3, fixed: true });
    expect(by("firstF").list?.itemFields.map((f) => f.key)).toEqual([
      "goal",
      "target",
      "progress",
    ]);
    expect(by("jester").list?.max).toBeGreaterThan(1);
  });
});

describe("currentQuarterLabel", () => {
  it("maps calendar boundaries to quarters", () => {
    expect(currentQuarterLabel(new Date(2026, 0, 1))).toBe("2026-Q1");
    expect(currentQuarterLabel(new Date(2026, 2, 31))).toBe("2026-Q1");
    expect(currentQuarterLabel(new Date(2026, 3, 1))).toBe("2026-Q2");
    expect(currentQuarterLabel(new Date(2026, 8, 16))).toBe("2026-Q3");
    expect(currentQuarterLabel(new Date(2026, 11, 31))).toBe("2026-Q4");
  });
});

describe("normalizeBoxText", () => {
  it("turns non-strings into empty text", () => {
    expect(normalizeBoxText(undefined)).toBe("");
    expect(normalizeBoxText(42)).toBe("");
    expect(normalizeBoxText({ a: 1 })).toBe("");
  });

  it("normalizes line endings, strips control chars, trims", () => {
    const nul = String.fromCharCode(0);
    const bell = String.fromCharCode(7);
    expect(normalizeBoxText(`  a\r\nb\rc${nul}d${bell} \n`)).toBe("a\nb\ncd");
    expect(normalizeBoxText("tab\tkept")).toBe("tab\tkept");
  });
});

describe("coerceEightBoxContent (read path)", () => {
  it("returns an empty board for nothing useful", () => {
    expect(coerceEightBoxContent(null)).toEqual(emptyEightBox());
    expect(coerceEightBoxContent([])).toEqual(emptyEightBox());
    expect(coerceEightBoxContent("x")).toEqual(emptyEightBox());
    expect(coerceEightBoxContent({ boxes: [] })).toEqual(emptyEightBox());
  });

  it("drops unknown boxes, fields, and item keys; coerces values", () => {
    const out = coerceEightBoxContent({
      version: 2,
      word: "  Steady \n ",
      boxes: {
        jester: {
          fields: { discussWith: " Tackle \r\n", evil: "x" },
          items: [
            { what: " snooze ", answer: 7, evil: "y" },
            { what: "", answer: "" },
            "not an item",
          ],
        },
        hacker: { fields: { notes: "nope" } },
      },
    });
    expect(out.word).toBe("Steady");
    expect(out.boxes.jester.fields.discussWith).toBe("Tackle");
    expect("evil" in out.boxes.jester.fields).toBe(false);
    expect(out.boxes.jester.items).toEqual([{ what: "snooze", answer: "" }]);
    expect(Object.keys(out.boxes)).toEqual([...EIGHT_BOX_KEYS]);
    expect("hacker" in out.boxes).toBe(false);
  });

  it("migrates a version-1 board (one string per box) into notes", () => {
    const out = coerceEightBoxContent({
      version: 1,
      boxes: { concentrica: "M first.", jester: " snooze \r\n" },
    });
    expect(out.boxes.concentrica.fields.notes).toBe("M first.");
    expect(out.boxes.concentrica.fields.m).toBe("");
    expect(out.boxes.jester.fields.notes).toBe("snooze");
    expect(out.boxes.jester.items).toEqual([]);
    expect(out.word).toBe("");
  });

  it("truncates over-long text instead of failing", () => {
    const out = coerceEightBoxContent({
      word: "w".repeat(EIGHT_BOX_WORD_MAX + 5),
      boxes: {
        alr: {
          fields: {
            mentor: "m".repeat(EIGHT_BOX_SHORT_MAX + 5),
            learning: "l".repeat(EIGHT_BOX_TEXT_MAX + 5),
            notes: "n".repeat(EIGHT_BOX_NOTES_MAX + 5),
          },
        },
        firstF: {
          items: Array.from({ length: 10 }, (_, i) => ({ goal: `g${i}` })),
        },
      },
    });
    expect(out.word).toHaveLength(EIGHT_BOX_WORD_MAX);
    expect(out.boxes.alr.fields.mentor).toHaveLength(EIGHT_BOX_SHORT_MAX);
    expect(out.boxes.alr.fields.learning).toHaveLength(EIGHT_BOX_TEXT_MAX);
    expect(out.boxes.alr.fields.notes).toHaveLength(EIGHT_BOX_NOTES_MAX);
    expect(out.boxes.firstF.items).toHaveLength(6);
  });

  it("keeps a numeric version and defaults a bad one", () => {
    expect(coerceEightBoxContent({ version: 3, boxes: {} }).version).toBe(3);
    expect(coerceEightBoxContent({ version: "3", boxes: {} }).version).toBe(
      EIGHT_BOX_VERSION,
    );
  });
});

describe("parse / serialize", () => {
  it("round-trips and stamps the schema version", () => {
    const content = emptyEightBox();
    content.word = "Steady";
    content.boxes.secondF.items = [{ name: "Tackle", plan: "coffee" }];
    const raw = serializeEightBoxContent({ ...content, version: 99 });
    expect(JSON.parse(raw).version).toBe(EIGHT_BOX_VERSION);
    const back = parseEightBoxContent(raw);
    expect(back.word).toBe("Steady");
    expect(back.boxes.secondF.items).toEqual([
      { name: "Tackle", plan: "coffee" },
    ]);
  });

  it("tolerates bad JSON and empty input", () => {
    expect(parseEightBoxContent("{not json")).toEqual(emptyEightBox());
    expect(parseEightBoxContent(null)).toEqual(emptyEightBox());
    expect(parseEightBoxContent("")).toEqual(emptyEightBox());
  });
});

describe("isEightBoxBlank", () => {
  it("is true only when every field, item, and the word are empty", () => {
    const content = emptyEightBox();
    expect(isEightBoxBlank(content)).toBe(true);
    content.boxes.thirdF.fields.study = "John";
    expect(isEightBoxBlank(content)).toBe(false);

    const wordOnly = emptyEightBox();
    wordOnly.word = "Steady";
    expect(isEightBoxBlank(wordOnly)).toBe(false);

    const itemOnly = emptyEightBox();
    itemOnly.boxes.firstF.items = [
      { goal: "1000 mi", target: "", progress: "" },
    ];
    expect(isEightBoxBlank(itemOnly)).toBe(false);
  });
});

describe("validateEightBoxSubmission (write path)", () => {
  const alr = (fields: Record<string, string>) => ({
    boxes: { alr: { fields } },
  });

  it("rejects non-object bodies", () => {
    expect(validateEightBoxSubmission(null, { requireContent: false }).ok).toBe(
      false,
    );
    expect(validateEightBoxSubmission([], { requireContent: false }).ok).toBe(
      false,
    );
  });

  it("accepts an all-blank draft but not an all-blank publish", () => {
    const draft = validateEightBoxSubmission(
      { boxes: {} },
      { requireContent: false },
    );
    expect(draft.ok).toBe(true);

    const publish = validateEightBoxSubmission(
      { boxes: {} },
      { requireContent: true },
    );
    expect(publish).toEqual({
      ok: false,
      error: expect.stringMatching(/at least one box/i),
    });
  });

  it("rejects over-long values rather than truncating, naming the field", () => {
    const field = validateEightBoxSubmission(
      alr({ mentor: "x".repeat(EIGHT_BOX_SHORT_MAX + 1) }),
      { requireContent: true },
    );
    expect(field).toEqual({
      ok: false,
      error: expect.stringMatching(/ALR.*Who you will learn from.*too long/),
    });

    const item = validateEightBoxSubmission(
      {
        boxes: {
          firstF: { items: [{ goal: "x".repeat(EIGHT_BOX_SHORT_MAX + 1) }] },
        },
      },
      { requireContent: true },
    );
    expect(item).toEqual({
      ok: false,
      error: expect.stringMatching(/1st F.*Goals.*Goal.*too long/),
    });

    const word = validateEightBoxSubmission(
      { word: "w".repeat(EIGHT_BOX_WORD_MAX + 1), ...alr({ mentor: "x" }) },
      { requireContent: true },
    );
    expect(word).toEqual({
      ok: false,
      error: expect.stringMatching(/Word for the Box.*too long/),
    });
  });

  it("rejects too many list entries", () => {
    const result = validateEightBoxSubmission(
      {
        boxes: {
          secondF: {
            items: [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }],
          },
        },
      },
      { requireContent: true },
    );
    expect(result).toEqual({
      ok: false,
      error: expect.stringMatching(/2nd F.*too many entries/),
    });
  });

  it("normalizes text, drops blank rows and unknown keys, defaults the period", () => {
    const result = validateEightBoxSubmission(
      {
        word: " Steady ",
        boxes: {
          firstF: {
            fields: { csaups: " BRR\r\n", evil: "x" },
            items: [
              { goal: " 1000 mi ", target: "1000", progress: "40", evil: "y" },
              { goal: "", target: "", progress: "" },
            ],
          },
        },
        extra: true,
      },
      { requireContent: true },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.word).toBe("Steady");
    expect(result.content.boxes.firstF.fields.csaups).toBe("BRR");
    expect("evil" in result.content.boxes.firstF.fields).toBe(false);
    expect(result.content.boxes.firstF.items).toEqual([
      { goal: "1000 mi", target: "1000", progress: "40" },
    ]);
    expect(result.content.version).toBe(EIGHT_BOX_VERSION);
    expect(result.period).toMatch(/^\d{4}-Q[1-4]$/);
  });

  it("validates the period label", () => {
    const empty = validateEightBoxSubmission(
      { ...alr({ mentor: "x" }), period: "   " },
      { requireContent: true },
    );
    expect(empty).toEqual({ ok: false, error: "Period is required." });

    const long = validateEightBoxSubmission(
      {
        ...alr({ mentor: "x" }),
        period: "p".repeat(EIGHT_BOX_PERIOD_MAX_CHARS + 1),
      },
      { requireContent: true },
    );
    expect(long.ok).toBe(false);

    const good = validateEightBoxSubmission(
      { ...alr({ mentor: "x" }), period: " Fall \n 2026 " },
      { requireContent: true },
    );
    expect(good).toMatchObject({ ok: true, period: "Fall 2026" });
  });
});

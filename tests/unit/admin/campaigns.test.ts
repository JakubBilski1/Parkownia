import { describe, expect, it } from "vitest";
import {
  MAX_PARAGRAPHS,
  MAX_RECIPIENTS,
  parseRecipients,
  splitParagraphs,
  templateData,
} from "@/modules/admin/campaigns";

/**
 * The list comes from a human pasting JSON, so the parser is the only thing
 * standing between a typo and a campaign that quietly skips somebody.
 */
describe("parseRecipients", () => {
  it("reads a plain array of addresses", () => {
    const result = parseRecipients('["a@b.pl", "c@d.pl"]');
    expect(result.recipients).toEqual([
      { email: "a@b.pl", name: null },
      { email: "c@d.pl", name: null },
    ]);
    expect(result.invalid).toEqual([]);
  });

  it("reads objects with a name, and the Polish field spellings", () => {
    const result = parseRecipients(
      '[{"email":"a@b.pl","name":"Jan"},{"mail":"c@d.pl","imie":"Ola"}]',
    );
    expect(result.recipients).toEqual([
      { email: "a@b.pl", name: "Jan" },
      { email: "c@d.pl", name: "Ola" },
    ]);
  });

  it("accepts a wrapper object", () => {
    expect(parseRecipients('{"recipients":["a@b.pl"]}').recipients).toHaveLength(1);
    expect(parseRecipients('{"emails":["a@b.pl"]}').recipients).toHaveLength(1);
  });

  it("collapses duplicates regardless of case, keeping the name it finds", () => {
    const result = parseRecipients('["A@B.pl", {"email":"a@b.pl","name":"Jan"}, "a@b.PL"]');
    expect(result.recipients).toEqual([{ email: "a@b.pl", name: "Jan" }]);
    expect(result.duplicates).toBe(2);
  });

  it("reports what it cannot read instead of dropping it", () => {
    const result = parseRecipients('["a@b.pl", "nie-mail", {"noEmail":true}, 42]');
    expect(result.recipients).toHaveLength(1);
    expect(result.invalid).toEqual(["nie-mail", '{"noEmail":true}', "42"]);
  });

  it("flags a list over the ceiling instead of silently truncating", () => {
    const many = Array.from({ length: MAX_RECIPIENTS + 5 }, (_, i) => `a${i}@b.pl`);
    const result = parseRecipients(JSON.stringify(many));
    expect(result.recipients).toHaveLength(MAX_RECIPIENTS);
    expect(result.truncated).toBe(true);
  });

  it("refuses input that is not JSON, in Polish", () => {
    expect(() => parseRecipients("a@b.pl, c@d.pl")).toThrowError(/poprawny JSON/);
  });

  it("refuses JSON that carries no list", () => {
    expect(() => parseRecipients('{"foo":"bar"}')).toThrowError(/nie widzę w nim listy/);
  });
});

describe("splitParagraphs", () => {
  it("treats a blank line as a paragraph break and joins wrapped lines", () => {
    expect(splitParagraphs("Pierwszy\nakapit.\n\nDrugi.")).toEqual(["Pierwszy akapit.", "Drugi."]);
  });

  it("drops empty blocks and caps at the number of template slots", () => {
    const body = Array.from({ length: MAX_PARAGRAPHS + 3 }, (_, i) => `p${i}`).join("\n\n");
    expect(splitParagraphs(body)).toHaveLength(MAX_PARAGRAPHS);
  });
});

describe("templateData", () => {
  const draft = {
    subject: "Temat",
    heading: "Nagłówek",
    paragraphs: ["Jeden", "Dwa"],
    preheader: undefined,
    ctaLabel: undefined,
    ctaUrl: undefined,
  };

  it("fills every slot, empty for the unused ones", () => {
    const data = templateData(draft, { name: null });
    expect(data.p1).toBe("Jeden");
    expect(data.p2).toBe("Dwa");
    expect(data.p3).toBe("");
    expect(data.p6).toBe("");
  });

  it("falls back to the first paragraph for the inbox preheader", () => {
    expect(templateData(draft, { name: null }).preheader).toBe("Jeden");
  });

  it("greets by name when there is one", () => {
    expect(templateData(draft, { name: "Jan" }).greeting).toBe("Dzień dobry, Jan");
    expect(templateData(draft, { name: null }).greeting).toBe("Dzień dobry");
  });

  it("resolves the CTA into a boolean, because the template cannot branch", () => {
    expect(templateData(draft, { name: null }).hasCta).toBe(false);
    const withCta = templateData(
      { ...draft, ctaLabel: "Kliknij", ctaUrl: "https://parkownia.com/" },
      { name: null },
    );
    expect(withCta.hasCta).toBe(true);
  });

  it("always carries a way out", () => {
    expect(String(templateData(draft, { name: null }).unsubscribeUrl)).toMatch(/^mailto:/);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractFreeInquiryText, extractFreeReplyText } from "../reply-text-extract";
import { DEFAULT_REPLY_CLOSING, DEFAULT_REPLY_OPENING } from "../reply-signature";

describe("extractFreeReplyText", () => {
  it("strips opening, inquiry block, and closing", () => {
    const raw = `${DEFAULT_REPLY_OPENING}

-----
פנייה #TK-100 בנושא בעיה — האפליקציה לא נפתחת
-----

העניין בטיפול אצלנו.

${DEFAULT_REPLY_CLOSING}`;

    const free = extractFreeReplyText(raw, {
      opening: DEFAULT_REPLY_OPENING,
      closing: DEFAULT_REPLY_CLOSING
    });
    assert.match(free, /העניין בטיפול/);
    assert.doesNotMatch(free, /היי\. בהמשך/);
    assert.doesNotMatch(free, /בברכה/);
    assert.doesNotMatch(free, /פנייה #TK/);
  });

  it("strips full composed reply and keeps multi-line operator text", () => {
    const raw = `${DEFAULT_REPLY_OPENING}

-----
פנייה #TK-14354 · 8 ביוני 2025 בנושא פנייה מהאתר: רכשתי מנוי
-----

שלום וברכה. האם הבעיה עדיין קיימת?
אם כן תכתוב לי ואטפל בהקדם

${DEFAULT_REPLY_CLOSING}`;

    const free = extractFreeReplyText(raw, {
      opening: DEFAULT_REPLY_OPENING,
      closing: DEFAULT_REPLY_CLOSING
    });
    assert.match(free, /שלום וברכה/);
    assert.match(free, /האם הבעיה עדיין קיימת/);
    assert.match(free, /אם כן תכתוב לי/);
    assert.doesNotMatch(free, /-----/);
    assert.doesNotMatch(free, /בהמשך לפנייתך/);
    assert.doesNotMatch(free, /בברכה/);
    assert.ok(free.includes("\n"), "preserves paragraph breaks");
  });
});

describe("extractFreeInquiryText", () => {
  it("keeps real inquiry and drops greeting-only noise", () => {
    const free = extractFreeInquiryText("שלום\n\nהאפליקציה קורסת כשאני פותח אותה");
    assert.match(free, /קורסת/);
    assert.doesNotMatch(free, /^שלום$/);
  });
});

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
});

describe("extractFreeInquiryText", () => {
  it("keeps real inquiry and drops greeting-only noise", () => {
    const free = extractFreeInquiryText("שלום\n\nהאפליקציה קורסת כשאני פותח אותה");
    assert.match(free, /קורסת/);
    assert.doesNotMatch(free, /^שלום$/);
  });
});

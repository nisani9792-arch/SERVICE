import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildQuestionKey } from "../reply-knowledge";

describe("buildQuestionKey", () => {
  it("same inquiry produces same key regardless of subject", () => {
    const a = buildQuestionKey("אפליקציה לא נפתחת", "האפליקציה לא נפתחת לי בכלל");
    const b = buildQuestionKey("בעיה באפליקציה", "האפליקציה לא נפתחת לי בכלל");
    assert.equal(a, b);
  });

  it("different inquiries produce different keys", () => {
    const a = buildQuestionKey("ביטול מנוי", "איך מבטלים מנוי פרימיום");
    const b = buildQuestionKey("העלאת שיר", "אני זמר ורוצה להעלות שיר");
    assert.notEqual(a, b);
  });
});

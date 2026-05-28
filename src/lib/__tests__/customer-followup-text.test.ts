import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  latestCustomerFollowUp,
  parseCustomerFollowUpBlocks
} from "../customer-followup-text";

describe("customer-followup-text", () => {
  it("parses single and multiple follow-up blocks", () => {
    const body = [
      "פנייה ראשונה מהלקוח",
      "",
      "---",
      "[תשובת לקוח · 1.1.2025, 10:00:00]",
      "הלו, עדיין לא קיבלתי מענה",
      "",
      "---",
      "[תשובת לקוח · 2.1.2025, 11:30:00]",
      "שוב פונה — הבעיה נמשכת"
    ].join("\n");

    const blocks = parseCustomerFollowUpBlocks(body);
    assert.equal(blocks.length, 2);
    assert.match(blocks[0].text, /עדיין לא קיבלתי/);
    assert.match(blocks[1].text, /הבעיה נמשכת/);

    const latest = latestCustomerFollowUp(body);
    assert.equal(latest?.text, "שוב פונה — הבעיה נמשכת");
  });
});

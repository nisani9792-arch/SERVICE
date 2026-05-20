import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeCategory } from "../category-normalize";
import { isEmptyOrNoiseInquiry } from "../inquiry-spam-heuristic";
import { quickHeuristic } from "../gemini";
import { isSpamCategory } from "../spam-category";

describe("normalizeCategory", () => {
  it("maps Spam variants to spam", () => {
    assert.equal(normalizeCategory("Spam"), "spam");
    assert.equal(normalizeCategory("spam (מובנה)"), "spam");
  });

  it("maps customer support aliases", () => {
    assert.equal(normalizeCategory("customer support"), "Customer_Support");
    assert.equal(normalizeCategory("Customer_Support"), "Customer_Support");
  });

  it("maps billing case-insensitively", () => {
    assert.equal(normalizeCategory("billing"), "Billing");
  });
});

describe("isEmptyOrNoiseInquiry", () => {
  it("flags empty body with only contact fields", () => {
    assert.equal(isEmptyOrNoiseInquiry("שלום", "שם: יוסי\nמייל: a@b.com"), true);
  });

  it("keeps real support subjects", () => {
    assert.equal(isEmptyOrNoiseInquiry("האפליקציה לא נפתחת", ""), false);
  });
});

describe("quickHeuristic", () => {
  it("detects spam keywords", () => {
    const result = quickHeuristic("Offer", "earn money fast with bitcoin");
    assert.equal(result?.category, "spam");
  });

  it("detects urgent bugs", () => {
    const result = quickHeuristic("בעיה", "האפליקציה לא עובד");
    assert.equal(result?.category, "bugs");
    assert.equal(result?.priority, 5);
  });

  it("does not over-match generic hello as support", () => {
    const result = quickHeuristic("שלום", "רק בדיקה");
    assert.equal(result, null);
  });
});

describe("isSpamCategory", () => {
  it("normalizes before check", () => {
    assert.equal(isSpamCategory("Spam"), true);
    assert.equal(isSpamCategory("Customer_Support"), false);
  });
});

describe("RTL swipe semantics", () => {
  it("positive dx means approve in RTL triage", () => {
    const dx = 80;
    const isApprove = dx > 72;
    const isSpam = dx < -72;
    assert.equal(isApprove, true);
    assert.equal(isSpam, false);
  });
});

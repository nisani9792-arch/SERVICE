import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isWebsiteContactRelay,
  isWebsiteContactRelaySender,
  unwrapWebsiteContactRelay
} from "@/lib/contact-form-inquiry";

const SAMPLE_BODY = `
שם מלא: יוסי כהן
טלפון נייד: 050-1234567
אימייל: yossi@gmail.com
הודעה: שלום, יש לי בעיה באפליקציה
קישור לעמוד: https://jusic.co/contact
IP השולח: 1.2.3.4
`.trim();

describe("website contact relay", () => {
  it("detects EDITOR relay sender", () => {
    assert.equal(isWebsiteContactRelaySender("EDITOR@JUSIC.CO", "editor@jusic.co"), true);
    assert.equal(isWebsiteContactRelaySender("relay@c28588.sgvps.net"), true);
    assert.equal(isWebsiteContactRelaySender("customer@gmail.com"), false);
  });

  it("treats EDITOR website forms as inquiries, not own outgoing", () => {
    assert.equal(
      isWebsiteContactRelay(
        "editor@jusic.co",
        "הודעה חדשה באתר Jusic",
        SAMPLE_BODY,
        "editor@jusic.co"
      ),
      true
    );
  });

  it("unwraps customer identity from relay body", () => {
    const unwrapped = unwrapWebsiteContactRelay(
      "editor@jusic.co",
      "Jusic Site",
      "הודעה חדשה באתר Jusic",
      SAMPLE_BODY,
      "editor@jusic.co"
    );
    assert.ok(unwrapped);
    assert.equal(unwrapped.senderEmail, "yossi@gmail.com");
    assert.equal(unwrapped.senderName, "יוסי כהן");
    assert.match(unwrapped.subject, /פנייה מהאתר/);
    assert.match(unwrapped.body, /050-1234567/);
    assert.match(unwrapped.body, /יש לי בעיה באפליקציה/);
  });
});

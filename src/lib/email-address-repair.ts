import { sql } from "@/lib/neon";

/** Common malformed domains (missing dot) from historical imports. */
const DOMAIN_SUFFIX_REPAIRS: Array<[string, string]> = [
  ["gmailcom", "gmail.com"],
  ["gamilcom", "gmail.com"],
  ["gmilcom", "gmail.com"],
  ["gimelcom", "gmail.com"],
  ["gimalcom", "gmail.com"],
  ["gimailcom", "gmail.com"],
  ["gmeilcom", "gmail.com"],
  ["gnailcom", "gmail.com"],
  ["gmialcom", "gmail.com"],
  ["gimlcom", "gmail.com"],
  ["gmailco", "gmail.com"],
  ["gmailcomcom", "gmail.com"],
  ["jmailcom", "gmail.com"],
  ["icloudcom", "icloud.com"],
  ["iclodcom", "icloud.com"],
  ["icoudcom", "icloud.com"],
  ["outlookcom", "outlook.com"],
  ["yahoocom", "yahoo.com"],
  ["hotmailcom", "hotmail.com"],
  ["aolcom", "aol.com"],
  ["googlemailcom", "googlemail.com"],
  ["wallacom", "walla.com"],
  ["jusicco", "jusic.co"],
  ["livecom", "live.com"],
  ["msncom", "msn.com"],
  ["protonmailcom", "protonmail.com"],
  ["ymailcom", "ymail.com"],
  ["gmailmoomm", "gmail.com"],
  ["gmailc0m", "gmail.com"],
  ["gmsilcon", "gmail.com"],
  ["gnailmmc", "gmail.com"],
  ["gimilert", "gmail.com"],
  ["gmailcon", "gmail.com"],
  ["outlookco", "outlook.com"],
  ["netonetil", "neto.net.il"],
  ["012netil", "012.net.il"],
  ["matavorgil", "matav.co.il"],
  ["hyneseasereliefnet", "hyneseaserelief.net"]
];

const EMAIL_VALID =
  /^[a-z0-9](?:[a-z0-9._%+-]*[a-z0-9])?@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i;

export function repairEmailAddress(raw: string): string {
  let email = raw.trim().toLowerCase();
  if (!email.includes("@")) return email;

  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  let domain = email.slice(at + 1);

  for (const [bad, good] of DOMAIN_SUFFIX_REPAIRS) {
    if (domain === bad || domain.endsWith(bad)) {
      domain = `${domain.slice(0, domain.length - bad.length)}${good}`;
    }
  }

  for (const [needle, good] of DOMAIN_SUFFIX_REPAIRS) {
    if (domain.includes(needle)) {
      domain = good;
      break;
    }
  }

  if (domain === "gcom" || domain.endsWith("gcom")) domain = "gmail.com";
  if (domain === "googlemailcom") domain = "gmail.com";
  if (domain.endsWith("orgil") && !domain.includes(".")) {
    domain = `${domain.slice(0, -5)}.co.il`;
  }
  if (domain.endsWith("coil") && !domain.includes(".")) {
    domain = `${domain.slice(0, -4)}co.il`;
  }
  if (domain.endsWith("netil") && !domain.includes(".")) {
    domain = `${domain.slice(0, -5)}.net.il`;
  }
  if (domain.endsWith("fr") && !domain.includes(".") && domain.length > 3) {
    domain = `${domain.slice(0, -2)}.fr`;
  }
  if (domain.endsWith("org") && !domain.includes(".")) {
    domain = `${domain.slice(0, -3)}.org`;
  }
  if (domain.endsWith("com") && !domain.includes(".") && domain.length > 4) {
    const guess = `${domain.slice(0, -3)}.com`;
    if (guess.includes(".")) domain = guess;
  }

  email = `${local}@${domain}`;
  return EMAIL_VALID.test(email) ? email : raw.trim().toLowerCase();
}

export type RepairEmailDomainsResult = {
  beforeMalformed: number;
  afterMalformed: number;
  updates: Array<{ bad: string; good: string; count: number }>;
};

export async function repairAllTicketEmailAddresses(): Promise<RepairEmailDomainsResult> {
  const beforeRows = await sql()`
    SELECT count(*)::int AS malformed
    FROM tickets
    WHERE sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  `;

  const updates: RepairEmailDomainsResult["updates"] = [];

  for (const [bad, good] of DOMAIN_SUFFIX_REPAIRS) {
    const rows = await sql()`
      UPDATE tickets
      SET
        sender_email = left(sender_email, length(sender_email) - ${bad.length}) || ${good},
        updated_at = now()
      WHERE lower(sender_email) LIKE ${`%${bad}`}
      RETURNING id
    `;
    if (rows.length > 0) {
      updates.push({ bad, good, count: rows.length });
    }
  }

  const fixedRows = await sql()`
    SELECT id, sender_email FROM tickets
    WHERE sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  `;

  let manualFixed = 0;
  for (const row of fixedRows) {
    const id = String((row as { id: string }).id);
    const current = String((row as { sender_email: string }).sender_email ?? "");
    const repaired = repairEmailAddress(current);
    if (repaired !== current && EMAIL_VALID.test(repaired)) {
      await sql()`
        UPDATE tickets SET sender_email = ${repaired}, updated_at = now() WHERE id = ${id}
      `;
      manualFixed += 1;
    }
  }
  if (manualFixed > 0) {
    updates.push({ bad: "(heuristic)", good: "valid", count: manualFixed });
  }

  const afterRows = await sql()`
    SELECT count(*)::int AS malformed
    FROM tickets
    WHERE sender_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  `;

  return {
    beforeMalformed: Number((beforeRows[0] as { malformed: number }).malformed ?? 0),
    afterMalformed: Number((afterRows[0] as { malformed: number }).malformed ?? 0),
    updates
  };
}

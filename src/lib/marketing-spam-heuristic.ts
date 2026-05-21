/** English contact-form loan / marketing spam (not Jusic support). */
const MARKETING_SPAM_PATTERNS = [
  /are you okay running your business/i,
  /without much funds/i,
  /fund your busines/i,
  /funding opportunity/i,
  /get funded on your/i,
  /capitalfund/i,
  /capital fund-hk/i,
  /loan term period/i,
  /burden of repayment/i,
  /growth of your business and projects/i,
  /just visited jusic/i,
  /just visited jusi/i,
  /contact form marketing/i,
  /automate your income/i,
  /money-making/i,
  /expensive ads/i,
  /earn 35%/i,
  /millions of websites/i,
  /blast your message/i,
  /impactful video/i,
  /reputation video/i,
  /investment opportunities/i,
  /gulf.based investors/i,
  /ebooks up to \d+ pages/i,
  /write us at:\s*info@/i,
  /give us a call on:\s*\+/i,
  /unsubscribe/i,
  /mailing\s+list/i,
  /you\s+are\s+receiving\s+this/i,
  /seo\s+(service|expert|agency)/i,
  /guest\s+post/i,
  /link\s+building/i,
  /we\s+can\s+help\s+your\s+(business|website)/i,
  /dear\s+(sir|owner|webmaster)/i
];

export function isMarketingSpamInquiry(subject: string, body: string): boolean {
  const text = `${subject} ${body}`.trim();
  if (!text) return false;
  return MARKETING_SPAM_PATTERNS.some((re) => re.test(text));
}

/** Parsed block appended when a customer replies on an existing ticket thread. */
export type CustomerFollowUpBlock = {
  when: string;
  text: string;
};

const FOLLOWUP_BLOCK_RE =
  /---\s*\n\[תשובת לקוח · ([^\]]+)\]\s*\n([\s\S]*?)(?=\n\n---\s*\n\[תשובת לקוח · |$)/g;

export function hasCustomerFollowUp(body: string): boolean {
  return /\[תשובת לקוח ·/.test(body);
}

export function parseCustomerFollowUpBlocks(body: string): CustomerFollowUpBlock[] {
  const blocks: CustomerFollowUpBlock[] = [];
  const re = new RegExp(FOLLOWUP_BLOCK_RE.source, FOLLOWUP_BLOCK_RE.flags);
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    blocks.push({
      when: match[1].trim(),
      text: match[2].trim()
    });
  }
  return blocks;
}

export function latestCustomerFollowUp(body: string): CustomerFollowUpBlock | null {
  const blocks = parseCustomerFollowUpBlocks(body);
  return blocks.length > 0 ? blocks[blocks.length - 1] : null;
}

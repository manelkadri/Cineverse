import type { HelpBlock, HelpLink } from './help-content';
import { isSafeInternalPath } from './notification-rules';

// The knowledge-base editor uses a small plain-text format instead of HTML, so published content can never carry markup
// or scripts: it is turned into the same typed blocks the built-in articles use, and rendered as text by React.
//
//   ## A section title
//   A paragraph.
//   1. A step          (consecutive numbered lines become one list of steps)
//   - A bullet         (consecutive dashed lines become one list)
//   > Note : an information box
//   > Attention : a warning box

export const KB_LIMITS = { blocks: 60, textMax: 1500, items: 30, slugMax: 80, titleMax: 140, summaryMax: 300, keywords: 15, keywordMax: 40, links: 8, labelMax: 60, questionMax: 200, answerMax: 1500 } as const;

export function parseArticleText(source: string): HelpBlock[] {
  const blocks: HelpBlock[] = [];
  const chunks = source.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((chunk) => chunk.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trim()).filter(Boolean);
    let paragraph: string[] = [];
    let steps: string[] = [];
    let bullets: string[] = [];
    const flush = () => {
      if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
      if (steps.length) blocks.push({ type: 'steps', items: steps });
      if (bullets.length) blocks.push({ type: 'list', items: bullets });
      paragraph = []; steps = []; bullets = [];
    };
    for (const line of lines) {
      let match: RegExpMatchArray | null;
      if ((match = line.match(/^##\s+(.+)$/))) { flush(); blocks.push({ type: 'h', text: match[1] }); }
      else if ((match = line.match(/^>\s*Attention\s*:\s*(.+)$/i))) { flush(); blocks.push({ type: 'warning', text: match[1] }); }
      else if ((match = line.match(/^>\s*Note\s*:\s*(.+)$/i))) { flush(); blocks.push({ type: 'note', text: match[1] }); }
      else if ((match = line.match(/^\d+[.)]\s+(.+)$/))) { if (paragraph.length || bullets.length) flush(); steps.push(match[1]); }
      else if ((match = line.match(/^[-*]\s+(.+)$/))) { if (paragraph.length || steps.length) flush(); bullets.push(match[1]); }
      else { if (steps.length || bullets.length) flush(); paragraph.push(line); }
    }
    flush();
  }
  return blocks;
}

export function blocksToText(blocks: HelpBlock[]): string {
  return blocks.map((block) => {
    switch (block.type) {
      case 'h': return `## ${block.text}`;
      case 'p': return block.text;
      case 'note': return `> Note : ${block.text}`;
      case 'warning': return `> Attention : ${block.text}`;
      case 'steps': return block.items.map((item, index) => `${index + 1}. ${item}`).join('\n');
      case 'list': return block.items.map((item) => `- ${item}`).join('\n');
    }
  }).join('\n\n');
}

/** Returns a French problem description, or null when the blocks are acceptable. */
export function blocksProblem(blocks: HelpBlock[]): string | null {
  if (blocks.length === 0) return 'Le contenu est vide.';
  if (blocks.length > KB_LIMITS.blocks) return `Le contenu est trop long (${KB_LIMITS.blocks} blocs au maximum).`;
  for (const block of blocks) {
    const texts = 'items' in block ? block.items : [block.text];
    if ('items' in block && (block.items.length === 0 || block.items.length > KB_LIMITS.items)) return `Une liste doit contenir de 1 à ${KB_LIMITS.items} éléments.`;
    if (texts.some((text) => text.length === 0 || text.length > KB_LIMITS.textMax)) return `Un paragraphe est trop long (${KB_LIMITS.textMax} caractères au maximum).`;
  }
  return null;
}

/** Only internal destinations: an article can link inside CINEVERSE, never to another site. */
export function linksProblem(links: HelpLink[]): string | null {
  if (links.length > KB_LIMITS.links) return `Au plus ${KB_LIMITS.links} liens.`;
  for (const link of links) {
    if (!link.label || link.label.length > KB_LIMITS.labelMax) return 'Chaque lien a besoin d’un libellé court.';
    if (!isSafeInternalPath(link.href)) return `« ${link.href} » n’est pas une page interne de CINEVERSE.`;
  }
  return null;
}

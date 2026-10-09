import 'server-only';
import { revalidatePath } from 'next/cache';

/**
 * The public Help Center pages are statically generated (so a missing or unpublished article is a real 404 and pages are fast).
 * Whenever the administration changes what they show (articles, FAQ, availability, contact categories) this refreshes them at
 * once, for every visitor. Failing to refresh must never fail the change itself: the pages also revalidate on a timer.
 */
export function revalidateHelp() {
  try {
    revalidatePath('/help');
    revalidatePath('/help/[slug]', 'page');
  } catch (error) {
    console.error(`[help] could not refresh the public pages (${(error as Error).name})`);
  }
}

import type { ContentItem } from './profile-types';

export interface MaturityAccess {
  isKids: boolean;
  maturityLevel: number;
}

export function isContentAllowed(maturityLevel: number, access: MaturityAccess | null) {
  return !access?.isKids || maturityLevel <= access.maturityLevel;
}

export function restrictItemsForProfile<T extends ContentItem>(items: T[], access: MaturityAccess | null) {
  return access?.isKids ? items.filter((item) => isContentAllowed(item.maturityLevel, access)) : items;
}

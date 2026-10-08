import React from 'react';
import { Baby, Clapperboard, Sparkles, UserRound } from 'lucide-react';

export const AVATAR_OPTIONS = [
  { id: 'ember', label: 'Rouge', className: 'from-[#f11b2a] to-[#6e0710]', icon: Clapperboard },
  { id: 'violet', label: 'Violet', className: 'from-[#9d4edd] to-[#40106d]', icon: Sparkles },
  { id: 'ocean', label: 'Bleu', className: 'from-[#168aad] to-[#103a73]', icon: UserRound },
  { id: 'mint', label: 'Enfants', className: 'from-[#38c793] to-[#0c6657]', icon: Baby },
] as const;

export default function ProfileAvatar({ avatar, name, className = '' }: { avatar: string; name: string; className?: string }) {
  const option = AVATAR_OPTIONS.find((item) => item.id === avatar) ?? AVATAR_OPTIONS[0];
  const Icon = option.icon;
  return (
    <span className={`relative grid place-items-center overflow-hidden bg-gradient-to-br ${option.className} ${className}`} aria-hidden="true">
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.3),transparent_42%)]" />
      <Icon className="relative text-white/95" size="44%" strokeWidth={1.8} />
      <span className="sr-only">Avatar de {name}</span>
    </span>
  );
}

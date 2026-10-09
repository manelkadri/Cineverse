import React from 'react';

interface CineverseLogoProps {
  className?: string;
  /** Element to render; the wordmark is always real text. */
  as?: 'span' | 'div';
}

/**
 * CINEVERSE wordmark: CINE in #E50914, VERSE in #FFFFFF, switching exactly between the E and the V.
 * Size comes from the surrounding font size (Tailwind `text-*` classes), so each page keeps its footprint.
 */
export default function CineverseLogo({ className = '', as: Tag = 'span' }: CineverseLogoProps) {
  return (
    <Tag className={`cineverse-logo ${className}`.trim()}>
      <span className="cineverse-logo__cine">CINE</span>
      <span className="cineverse-logo__verse">VERSE</span>
    </Tag>
  );
}

export interface RoomIllustrationProps {
  variant: 'before' | 'after';
}

export function RoomIllustration({ variant }: RoomIllustrationProps) {
  const stroke = variant === 'before' ? 'var(--color-muted-border)' : 'var(--color-accent)';
  const opacity = variant === 'before' ? 0.6 : 0.9;

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`room-illustration room-illustration--${variant}`}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="96" height="96" rx="2" fill="none" stroke={stroke} strokeWidth="0.6" opacity={opacity} />
      <rect x="6" y="64" width="24" height="24" rx="1.5" fill="none" stroke={stroke} strokeWidth="0.6" opacity={opacity} />
      <rect x="70" y="15" width="16" height="55" rx="1" fill="none" stroke={stroke} strokeWidth="0.6" opacity={opacity} />
      <line x1="2" y1="80" x2="98" y2="80" stroke={stroke} strokeWidth="0.4" opacity={opacity * 0.6} />
    </svg>
  );
}

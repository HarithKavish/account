import Link from 'next/link';
import { site } from '@/lib/config/site';

/** The HarithKavish monogram, drawn to match the ecosystem mark. */
export function BrandMark({ className = 'brand__mark' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label="HarithKavish"
      focusable="false"
    >
      <rect x="1" y="1" width="62" height="62" rx="18" fill="var(--accent)" />
      <path
        d="M18 17.5h7.4v11.9h13.2V17.5H46v29H38.6V35.9H25.4v10.6H18z"
        fill="var(--surface-strong)"
      />
    </svg>
  );
}

interface BrandProps {
  /** Where the lockup links. Signed-in users go to their account. */
  href?: string;
  descriptor?: string;
}

export function Brand({ href = '/', descriptor = site.descriptor }: BrandProps) {
  return (
    <Link className="brand" href={href}>
      <BrandMark />
      <span className="brand__text">
        <span className="brand__name">HarithKavish Account</span>
        <span className="brand__descriptor">{descriptor}</span>
      </span>
    </Link>
  );
}

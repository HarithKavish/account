import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/lib/config/site';

/** The HarithKavish Account mark shared by the favicon and app chrome. */
export function BrandMark({ className = 'brand__mark' }: { className?: string }) {
  return (
    <Image
      className={className}
      src="/hk-account-logo.png"
      alt="HarithKavish Account"
      width={1024}
      height={1024}
      priority
    />
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

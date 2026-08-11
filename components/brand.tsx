import Link from 'next/link';
import Image from 'next/image';

/** The HarithKavish Account mark shared by the favicon and app chrome. */
export function BrandMark({ className = 'brand__mark' }: { className?: string }) {
  return (
    <Image
      className={className}
      src="/hk-account-logo.png"
      alt=""
      width={192}
      height={192}
      priority
    />
  );
}

/**
 * Mark plus wordmark. The product is "Account" — the HarithKavish identity
 * comes from the mark, the way Google brands its account app.
 */
export function Brand({ href = '/account' }: { href?: string }) {
  return (
    <Link className="brand" href={href}>
      <BrandMark />
      <span className="brand__name">Account</span>
    </Link>
  );
}

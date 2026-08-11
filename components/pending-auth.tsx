import { authPlatform } from '@/lib/config/site';

/**
 * The Account/Auth boundary, made visible.
 *
 * Every management operation needs to know which account is asking. That proof
 * comes from the Authentication Platform, and the contract between the two
 * products is not finalised. Rather than inventing a second login here, the
 * pages state the dependency plainly.
 *
 * When the contract lands, these panels are what get replaced with real data —
 * nothing else on the page needs to change.
 */
export function PendingAuth({ action }: { action: string }) {
  return (
    <div className="pending" role="note">
      <p className="pending__title">Sign-in required</p>
      <p className="pending__body">
        {action} needs proof of who you are. That is handled by {authPlatform.name} at{' '}
        <strong>{authPlatform.domain}</strong>, which is a separate service still being built.
        Until it is connected, this page shows what will be here rather than acting on your
        account.
      </p>
    </div>
  );
}

/** Marks an individual control that cannot act yet. */
export function PendingPill() {
  return <span className="pill pill--planned">Needs sign-in</span>;
}

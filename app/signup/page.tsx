import { permanentRedirect } from 'next/navigation';

/**
 * The route moved to /create_account, which is what the ecosystem's sign-in page
 * links to. Kept so anything already pointing here still arrives.
 */
export default function SignupRedirect() {
  permanentRedirect('/create_account');
}

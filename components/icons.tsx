import type { CategoryId } from '@/lib/config/site';

const paths: Record<CategoryId, string> = {
  overview: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  security: 'M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10M5.5 10h13v10h-13z',
  delete: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10.5 11v5M13.5 11v5',
};

export function CategoryIcon({ id }: { id: CategoryId }) {
  return (
    <svg
      className="rail__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[id]} />
    </svg>
  );
}

export function ChevronIcon() {
  return (
    <svg
      className="row__chevron"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

/** Edit. The affordance on a field that is shown rather than typed into. */
export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"
         fill="none" stroke="currentColor" strokeWidth="1.8"
         strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/**
 * The placeholder person.
 *
 * Not an empty circle: a blank where a face belongs reads as something failing
 * to load. This is the account's picture until it is given another one, and it
 * is what every provider picture falls back to.
 */
export function PersonMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M12 12.4a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z" />
      <path d="M12 14.1c-4.05 0-7.3 2.2-7.3 4.9v.9a.9.9 0 0 0 .9.9h12.8a.9.9 0 0 0 .9-.9v-.9c0-2.7-3.25-4.9-7.3-4.9Z" />
    </svg>
  );
}

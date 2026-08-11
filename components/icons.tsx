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

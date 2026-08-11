import type { CategoryId } from '@/lib/config/site';

const paths: Record<CategoryId, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9',
  'personal-info': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  privacy: 'M12 3.5 5 6.2V12c0 4.3 2.9 7.4 7 8.5 4.1-1.1 7-4.2 7-8.5V6.2l-7-2.7Z',
  security: 'M7.5 10V7.5a4.5 4.5 0 0 1 9 0V10M5.5 10h13v10h-13z',
  preferences: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 4.8v4.4M8 14.8v4.4',
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

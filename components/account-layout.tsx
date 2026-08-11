'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { categories } from '@/lib/config/site';
import { CategoryIcon } from './icons';

function normalize(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

/**
 * Account management: category rail on the left, selected category on the
 * right. No route guard — the Account Platform has no session to guard with.
 * Individual pages declare their own dependency on the Auth Platform.
 */
export function AccountLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = normalize(usePathname());

  return (
    <div className="account-app">
      <nav className="rail" aria-label="Account management">
        {categories.map((category) => {
          const active = pathname === category.href;
          return (
            <Link
              key={category.id}
              href={category.href}
              className={`rail__item${active ? ' is-active' : ''}${
                category.id === 'delete' ? ' rail__item--danger' : ''
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <CategoryIcon id={category.id} />
              <span>{category.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="pane">
        <h1 className="pane__title">{title}</h1>
        {children}
      </div>
    </div>
  );
}

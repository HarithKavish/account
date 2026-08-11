'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { categories } from '@/lib/config/site';
import { normalizePath } from '@/lib/account/redirect';
import { CategoryIcon } from './icons';
import { RequireAuth } from './route-guard';

/**
 * The account application: a persistent category rail on the left, the selected
 * category on the right. Every signed-in page renders inside this.
 */
export function AccountLayout({ title, children }: { title: string; children: React.ReactNode }) {
  const pathname = normalizePath(usePathname());

  return (
    <RequireAuth>
      <div className="account-app">
        <nav className="rail" aria-label="Account categories">
          {categories.map((category) => {
            const active = pathname === category.href;
            return (
              <Link
                key={category.id}
                href={category.href}
                className={`rail__item${active ? ' is-active' : ''}`}
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
    </RequireAuth>
  );
}

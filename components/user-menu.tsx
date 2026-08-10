'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { accountNav } from '@/lib/config/site';
import type { AccountUser } from '@/lib/account/types';
import { useAuth } from './auth-provider';

export function initials(user: AccountUser): string {
  const first = user.firstName.trim()[0] ?? '';
  const last = user.lastName.trim()[0] ?? '';
  return `${first}${last}`.toUpperCase() || user.userId.slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: { user: AccountUser }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace('/login');
  }

  return (
    <div className="user-menu" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="avatar" aria-hidden="true">
          {initials(user)}
        </span>
        <span>{user.firstName}</span>
        <span className="visually-hidden">Open account menu</span>
      </button>

      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__identity">
            <span className="user-menu__name">
              {user.firstName} {user.lastName}
            </span>
            <span className="user-menu__id">{user.userId}</span>
          </div>

          {accountNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="user-menu__item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <button
            type="button"
            className="user-menu__item user-menu__item--danger"
            role="menuitem"
            onClick={handleSignOut}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

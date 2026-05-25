'use client';

import { useEffect } from 'react';

export function NavDrawerController() {
  useEffect(() => {
    const drawer = document.getElementById('nav-drawer');
    const openBtn = document.getElementById('nav-toggle');
    if (!drawer || !openBtn) return;

    const syncHeaderHeight = () => {
      const header = document.querySelector('header.sticky');
      if (header instanceof HTMLElement) {
        document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
      }
    };
    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(syncHeaderHeight).catch(() => {});
    }

    const open = () => {
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      openBtn.setAttribute('aria-label', 'Close menu');
      document.body.style.overflow = 'hidden';
    };
    const close = () => {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
      openBtn.setAttribute('aria-label', 'Open menu');
      document.body.style.overflow = '';
    };
    const toggle = () => {
      if (drawer.classList.contains('is-open')) close();
      else open();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const drawerLinks = Array.from(drawer.querySelectorAll('a'));

    openBtn.addEventListener('click', toggle);
    drawerLinks.forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('resize', syncHeaderHeight);
      openBtn.removeEventListener('click', toggle);
      drawerLinks.forEach((a) => a.removeEventListener('click', close));
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return null;
}

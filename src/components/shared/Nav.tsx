import Link from 'next/link';
import { Wordmark } from './Wordmark';
import { NavDrawerController } from './NavDrawerController';

export function Nav() {
  return (
    <>
      <header className="sticky top-0 z-[200] backdrop-blur-md bg-background/70 border-b hairline">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center group" aria-label="memrails home">
            <Wordmark className="logo-wordmark" />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-[13px] text-muted-foreground">
            <div className="nav-dropdown">
              <button
                className="nav-link nav-dropdown-trigger"
                style={{ color: 'inherit' }}
                aria-haspopup="true"
                aria-expanded="false"
              >
                Product
                <svg
                  className="nav-chevron"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="3,4.5 6,7.5 9,4.5" />
                </svg>
              </button>
              <div className="nav-dropdown-panel" role="menu">
                <Link href="/#memory" role="menuitem">Memory</Link>
                <Link href="/harness" role="menuitem">Harness</Link>
                <Link href="/console" role="menuitem">Console</Link>
                <Link href="/streaming" role="menuitem">Streaming</Link>
                <Link href="/mcp" role="menuitem">MCP</Link>
                <Link href="/console-live" role="menuitem">Console (live)</Link>
              </div>
            </div>
            <Link href="/pricing" className="nav-link" style={{ color: 'inherit' }}>
              Pricing
            </Link>
            <div className="nav-dropdown">
              <button
                className="nav-link nav-dropdown-trigger"
                style={{ color: 'inherit' }}
                aria-haspopup="true"
                aria-expanded="false"
              >
                Resources
                <svg
                  className="nav-chevron"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="3,4.5 6,7.5 9,4.5" />
                </svg>
              </button>
              <div className="nav-dropdown-panel" role="menu">
                <Link href="/#research" role="menuitem">Research</Link>
                <Link href="/#blog" role="menuitem">Blog</Link>
                <Link href="/#docs" role="menuitem">Docs</Link>
                <Link href="/#community" role="menuitem">Community</Link>
              </div>
            </div>
            <span className="h-4 w-px bg-border ml-1" />
            <a
              href="https://github.com/memrails"
              className="inline-flex items-center gap-1.5 text-[13px] hover:opacity-80 transition"
              style={{ color: 'color-mix(in oklab, var(--muted-foreground) 95%, transparent)' }}
              aria-label="GitHub repository"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-1.93c-3.2.7-3.87-1.54-3.87-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.76 2.69 1.25 3.34.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.24 2.75.12 3.04.74.8 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.35.78 1.04.78 2.1v3.11c0 .3.21.66.79.55C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
              </svg>
              <span className="font-medium tabular-nums" style={{ color: 'var(--foreground)' }}>
                102.6K
              </span>
            </a>
            <Link href="/#dashboard" className="nav-pill">
              Start for free
            </Link>
            <Link href="/#login" className="nav-pill-light">
              Login
            </Link>
          </nav>

          <button
            id="nav-toggle"
            className="nav-hamburger -mr-2 p-2 rounded-md hover:bg-graphite/60 transition"
            aria-label="Open menu"
            aria-expanded="false"
            aria-controls="nav-drawer"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line className="line-top" x1="4" y1="9" x2="20" y2="9" />
              <line className="line-bottom" x1="4" y1="15" x2="20" y2="15" />
            </svg>
          </button>
        </div>
      </header>

      <aside
        id="nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
        aria-hidden="true"
      >
        <nav className="nav-drawer-list">
          <div className="nav-drawer-group">
            <div className="nav-drawer-group-title">Product</div>
            <Link href="/#memory">Memory</Link>
            <Link href="/harness">Harness</Link>
            <Link href="/console">Console</Link>
            <Link href="/streaming">Streaming</Link>
            <Link href="/mcp">MCP</Link>
            <Link href="/console-live">Console (live)</Link>
          </div>
          <div className="nav-drawer-group">
            <Link href="/pricing">Pricing</Link>
          </div>
          <div className="nav-drawer-group">
            <div className="nav-drawer-group-title">Resources</div>
            <Link href="/#research">Research</Link>
            <Link href="/#blog">Blog</Link>
            <Link href="/#docs">Docs</Link>
            <Link href="/#community">Community</Link>
          </div>
          <div className="nav-drawer-cta">
            <Link href="/#dashboard" className="nav-drawer-cta-btn">
              Start for free
            </Link>
            <Link href="/#login" className="nav-drawer-cta-btn nav-drawer-cta-btn--light">
              Login
            </Link>
          </div>
        </nav>
      </aside>

      <NavDrawerController />
    </>
  );
}

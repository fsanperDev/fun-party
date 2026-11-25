import { BarChart3, Home, Library, PlusCircle, Settings } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils';
import { VoiceButton } from './VoiceButton';

const NAV = [
  { to: '/', label: 'Inicio', icon: Home, end: true },
  { to: '/juegos', label: 'Juegos', icon: Library },
  { to: '/nueva', label: 'Nueva', icon: PlusCircle },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/ajustes', label: 'Ajustes', icon: Settings },
];

/** Estructura común: fondo con degradados, contenido centrado, barra inferior y micro. */
export function AppShell() {
  return (
    <div className="min-h-dvh bg-[#090A10] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(139,92,246,0.14),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(6,182,212,0.08),transparent_50%)]" />
      <main className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-4 pb-36">
        <Outlet />
      </main>
      <VoiceButton />
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[#262a3b]/80 bg-[#0c0d14]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-[60px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-violet-300' : 'text-zinc-500 hover:text-zinc-300',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-7 w-11 items-center justify-center rounded-[14px]', isActive && 'bg-violet-500/15')}>
                    <Icon className="size-[18px]" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Cabecera de página: antetítulo morado + título grande. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-zinc-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

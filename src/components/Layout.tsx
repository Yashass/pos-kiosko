import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  Package,
  ClipboardList,
  FileText,
} from 'lucide-react';
import Navbar from './Navbar';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ventas', icon: ShoppingCart, label: 'Ventas' },
  { to: '/historial', icon: History, label: 'Historial' },
  { to: '/productos', icon: Package, label: 'Productos' },
  { to: '/inventario', icon: ClipboardList, label: 'Inventario' },
  { to: '/logs', icon: FileText, label: 'Logs' },
];

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar – desktop */}
        <aside className="hidden md:flex flex-col w-56 bg-zinc-900 shadow-xl border-r border-zinc-800">
          <nav className="flex-1 py-4 px-2 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-red-700 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-600 text-center">v1.0.0</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav – mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 flex z-50">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors ${
                isActive ? 'text-red-500' : 'text-zinc-500'
              }`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

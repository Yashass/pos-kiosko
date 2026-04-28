import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  ClipboardList,
} from 'lucide-react';
import Navbar from './Navbar';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/ventas', icon: ShoppingCart, label: 'Ventas' },
  { to: '/productos', icon: Package, label: 'Productos' },
  { to: '/inventario', icon: ClipboardList, label: 'Inventario' },
];

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar – desktop */}
        <aside className="hidden md:flex flex-col w-56 bg-slate-800 text-white shadow-xl">
          <nav className="flex-1 py-4 px-2 space-y-1">
            {navItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-700">
            <p className="text-xs text-slate-500 text-center">v1.0.0</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav – mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex z-50">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors ${
                isActive ? 'text-blue-400' : 'text-slate-400'
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

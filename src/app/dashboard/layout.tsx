// Макет панели управления
import Link from "next/link";
import { auth, signOut } from "@/lib/auth/auth";

const NAV = [
  { href: "/dashboard", label: "Обзор", icon: "📊" },
  { href: "/dashboard/leads", label: "Заявки", icon: "📋" },
  { href: "/dashboard/sources", label: "Источники", icon: "🔌" },
  { href: "/dashboard/settings", label: "Настройки", icon: "⚙️" },
  { href: "/dashboard/analytics", label: "Аналитика", icon: "📈" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl font-semibold text-gray-900">Доступ запрещён</p>
          <p className="mt-2 text-gray-500">Войдите в систему</p>
          <Link
            href="/api/auth/signin"
            className="mt-6 inline-block rounded-xl bg-indigo-600 px-6 py-3 text-white hover:bg-indigo-500"
          >
            Войти
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Верхняя панель */}
      <header className="sticky top-0 z-50 border-b bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-indigo-600">◈</span> Leads AI
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{session.user.email}</span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6">
        {/* Боковая навигация */}
        <nav className="hidden w-56 shrink-0 lg:block">
          <ul className="space-y-1 sticky top-24">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
                >
                  <span>{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Контент */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

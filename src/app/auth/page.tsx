// Страница входа
import { signIn } from "@/lib/auth/auth";
import Link from "next/link";

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-bold text-2xl">
            <span className="text-indigo-600">◈</span> Leads AI
          </Link>
          <p className="mt-2 text-gray-500">Войдите в панель управления</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200">
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email") as string,
                password: formData.get("password") as string,
                redirectTo: "/dashboard",
              });
            }}
            className="space-y-5"
          >
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="ваш@email.ru"
                className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
            >
              Войти
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Первый вход? Напишите{" "}
            <a href="https://t.me/bilarius" target="_blank" rel="noopener" className="text-indigo-600 hover:underline">
              в Telegram
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// Страница входа
import { signIn } from "@/lib/auth/auth";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthPage() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-layer)", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            fontSize: "var(--text-xl)", fontWeight: 700,
            color: "var(--ink-heading)", letterSpacing: "-0.02em",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "var(--radius-sm)",
              background: "var(--accent)", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 800,
            }}>
              ◈
            </div>
            Leads AI
          </Link>
          <p style={{ color: "var(--ink-muted)", marginTop: 8, fontSize: "var(--text-sm)" }}>
            Войдите в панель управления
          </p>
        </div>

        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "32px 28px",
        }}>
          <form
            action={async (formData: FormData) => {
              "use server";
              await signIn("credentials", {
                email: formData.get("email") as string,
                password: formData.get("password") as string,
                redirectTo: "/dashboard",
              });
            }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}
          >
            <div>
              <label style={{
                display: "block", fontSize: "var(--text-xs)", fontWeight: 600,
                color: "var(--ink-body)", marginBottom: 6,
              }}>
                Email
              </label>
              <input
                name="email" type="email" required
                placeholder="ваш@email.ru"
                style={{
                  width: "100%", padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-root)",
                  color: "var(--ink-body)",
                  fontSize: "var(--text-sm)",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <div>
              <label style={{
                display: "block", fontSize: "var(--text-xs)", fontWeight: 600,
                color: "var(--ink-body)", marginBottom: 6,
              }}>
                Пароль
              </label>
              <input
                name="password" type="password" required
                placeholder="••••••••"
                style={{
                  width: "100%", padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-root)",
                  color: "var(--ink-body)",
                  fontSize: "var(--text-sm)",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>
            <button type="submit" style={{
              width: "100%", padding: "12px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none", background: "var(--accent)",
              color: "#fff", fontWeight: 600,
              fontSize: "var(--text-sm)", cursor: "pointer",
              marginTop: 4,
            }}>
              Войти
            </button>
          </form>

          <p style={{
            textAlign: "center", marginTop: 20,
            fontSize: "var(--text-xs)", color: "var(--ink-muted)",
          }}>
            Нет аккаунта?{" "}
            <a href="https://t.me/bilarius" target="_blank" rel="noopener" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Напишите в Telegram
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

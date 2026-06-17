// Страница входа и регистрации
import { signIn } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { hash } from "bcryptjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export default function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  return <AuthContent sp={searchParams} />;
}

async function AuthContent({ sp }: { sp: Promise<{ tab?: string; error?: string }> }) {
  const { tab, error } = await sp;
  const isRegister = tab === "register";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-layer)", padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
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
            }}>◈</div>
            Leads AI
          </Link>
        </div>

        {/* Табы */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr",
          border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          overflow: "hidden", marginBottom: -1, position: "relative", zIndex: 1,
        }}>
          <Link href="?tab=login" style={{
            padding: "12px", textAlign: "center", fontWeight: 600, fontSize: "var(--text-sm)",
            background: !isRegister ? "var(--bg-surface)" : "var(--bg-layer)",
            color: !isRegister ? "var(--ink-heading)" : "var(--ink-muted)",
            borderBottom: !isRegister ? "2px solid var(--accent)" : "1px solid var(--border)",
            textDecoration: "none",
          }}>Вход</Link>
          <Link href="?tab=register" style={{
            padding: "12px", textAlign: "center", fontWeight: 600, fontSize: "var(--text-sm)",
            background: isRegister ? "var(--bg-surface)" : "var(--bg-layer)",
            color: isRegister ? "var(--ink-heading)" : "var(--ink-muted)",
            borderBottom: isRegister ? "2px solid var(--accent)" : "1px solid var(--border)",
            textDecoration: "none",
          }}>Регистрация</Link>
        </div>

        <div style={{
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderTop: "none", borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
          padding: "28px 24px",
        }}>
          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: "var(--radius-sm)",
              background: "var(--red-soft)", color: "var(--red)",
              fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: 16,
            }}>
              {error === "CredentialsSignin" ? "Неверный email или пароль" :
               error === "EmailExists" ? "Пользователь с таким email уже существует" :
               error}
            </div>
          )}

          {isRegister ? (
            <RegisterForm />
          ) : (
            <LoginForm />
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: "var(--text-xs)", color: "var(--ink-muted)" }}>
          {isRegister ? "Уже есть аккаунт? " : "Нет аккаунта? "}
          <Link href={isRegister ? "?tab=login" : "?tab=register"} style={{ color: "var(--accent)", fontWeight: 600 }}>
            {isRegister ? "Войти" : "Зарегистрироваться"}
          </Link>
        </p>
      </div>
    </div>
  );
}

function LoginForm() {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        await signIn("credentials", {
          email: formData.get("email") as string,
          password: formData.get("password") as string,
          redirectTo: "/dashboard",
        });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <InputField label="Email" name="email" type="email" placeholder="ваш@email.ru" />
      <InputField label="Пароль" name="password" type="password" placeholder="••••••••" />
      <button type="submit" style={btnStyle}>
        Войти
      </button>
    </form>
  );
}

function RegisterForm() {
  return (
    <form
      action={async (formData: FormData) => {
        "use server";
        const email = (formData.get("email") as string).trim();
        const password = formData.get("password") as string;
        const name = (formData.get("name") as string).trim();

        if (!email || !password) return;
        if (password.length < 6) {
          redirect("/auth?tab=register&error=Пароль должен быть не менее 6 символов");
        }

        // Проверяем существование
        const exists = await db.user.findUnique({ where: { email } });
        if (exists) {
          redirect("/auth?tab=register&error=EmailExists");
        }

        // Создаём пользователя
        const passwordHash = await hash(password, 12);
        const user = await db.user.create({
          data: { email, passwordHash, firstName: name || email.split("@")[0] },
        });

        // Создаём workspace и настройки
        const workspace = await db.workspace.create({
          data: { userId: user.id, name: "Моё пространство", slug: `ws-${user.id.slice(0, 8)}` },
        });
        await db.settings.create({ data: { workspaceId: workspace.id } });

        // Авто-вход
        await signIn("credentials", {
          email,
          password,
          redirectTo: "/dashboard",
        });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <InputField label="Имя" name="name" type="text" placeholder="Алексей" />
      <InputField label="Email" name="email" type="email" placeholder="ваш@email.ru" />
      <InputField label="Пароль" name="password" type="password" placeholder="Минимум 6 символов" />
      <button type="submit" style={btnStyle}>
        Зарегистрироваться
      </button>
    </form>
  );
}

function InputField({ label, name, type, placeholder }: {
  label: string; name: string; type: string; placeholder: string;
}) {
  return (
    <div>
      <label style={{
        display: "block", fontSize: "var(--text-xs)", fontWeight: 600,
        color: "var(--ink-body)", marginBottom: 6,
      }}>
        {label}
      </label>
      <input
        name={name} type={type} required
        placeholder={placeholder}
        style={{
          width: "100%", padding: "11px 14px", borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)", background: "var(--bg-root)",
          color: "var(--ink-body)", fontSize: "var(--text-sm)",
          outline: "none", boxSizing: "border-box",
        }}
      />
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", borderRadius: "var(--radius-sm)",
  border: "none", background: "var(--accent)", color: "#fff",
  fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer", marginTop: 2,
};

function YandexButton() {
  return (
    <form action={async () => { "use server"; await signIn("yandex", { redirectTo: "/dashboard" }); }}>
      <button type="submit" style={{
        width: "100%", padding: "11px 14px", borderRadius: "var(--radius-sm)",
        border: "none", background: "#FC3F1D", color: "#fff",
        fontWeight: 600, fontSize: "var(--text-sm)", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>Я</span>
        Войти с Яндекс ID
      </button>
    </form>
  );
}

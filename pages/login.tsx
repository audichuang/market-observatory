import { useState } from "react";
import { auth } from "void/client";
import type { Props } from "./login.server";

export default function LoginPage({ next, hasUser }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">(hasUser ? "signin" : "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res =
      mode === "signin"
        ? await auth.signIn.email({ email, password })
        : await auth.signUp.email({ email, password, name: email.split("@")[0] });
    setPending(false);
    if (res.error) {
      setError(res.error.message || "登入失敗");
      return;
    }
    window.location.href = next;
  }

  return (
    <main>
      <div className="panel login-card">
        <h1>市場觀測室</h1>
        <p className="sub">{mode === "signin" ? "請登入" : "尚未建立帳號：請用擁有者 email 建立"}</p>
        <form className="stack" onSubmit={submit} style={{ marginTop: "1rem" }}>
          <label className="field">
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            密碼
            <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          <button disabled={pending}>{pending ? "處理中…" : mode === "signin" ? "登入" : "建立帳號"}</button>
          {!hasUser && (
            <button type="button" className="secondary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
              {mode === "signin" ? "改為建立帳號" : "已有帳號，改為登入"}
            </button>
          )}
        </form>
      </div>
    </main>
  );
}

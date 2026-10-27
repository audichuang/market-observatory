import { useState } from "react";
import { auth } from "void/client";
import type { Props } from "./login.server";

/** Better Auth 的錯誤訊息是英文，依錯誤碼換成中文（Email 登入的錯誤碼與 iOS 的 API.translateAuth 一致，iOS 另有 Apple 登入的）；沒對應到的不顯示原文。 */
const AUTH_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Email 或密碼不正確",
  INVALID_PASSWORD: "Email 或密碼不正確",
  USER_ALREADY_EXISTS: "這個 Email 已經註冊過，請直接登入",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "這個 Email 已經註冊過，請直接登入",
  PASSWORD_TOO_SHORT: "密碼至少 8 個字",
  PASSWORD_TOO_LONG: "密碼太長",
  INVALID_EMAIL: "Email 格式不正確",
  FAILED_TO_CREATE_SESSION: "無法建立登入狀態，請稍後再試",
  FAILED_TO_CREATE_USER: "無法建立帳號，請稍後再試",
};

function authErrorText(code: string | undefined, mode: "signin" | "signup") {
  return (code && AUTH_ERRORS[code]) || (mode === "signin" ? "登入失敗，請稍後再試" : "建立帳號失敗，請稍後再試");
}

export default function LoginPage({ next }: Props) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
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
      setError(authErrorText(res.error.code, mode));
      return;
    }
    window.location.href = next;
  }

  return (
    <main>
      <div className="panel login-card">
        <h1>市場觀測室</h1>
        <p className="sub">{mode === "signin" ? "請登入" : "建立新帳號（密碼至少 8 個字）"}</p>
        <form className="stack" onSubmit={submit} style={{ marginTop: "1rem" }}>
          <label className="field">
            Email
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            密碼
            <input type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <p className="error" role="alert">{error}</p>}
          <button disabled={pending}>{pending ? "處理中…" : mode === "signin" ? "登入" : "建立帳號"}</button>
          <button type="button" className="secondary" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "還沒有帳號？建立帳號" : "已有帳號，改為登入"}
          </button>
        </form>
      </div>
    </main>
  );
}

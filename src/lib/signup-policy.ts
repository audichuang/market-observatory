/**
 * 個人站的註冊規則：只有 OWNER_EMAIL 能建立帳號（email 唯一，最多一個帳號）。
 * 另外設了 OWNER_SIGNUP_CODE 時還要帶相同的註冊碼——全新部署、帳號還沒建立前，
 * 只知道 email 的人也搶不走擁有者帳號。回傳 null 表示允許，否則是拒絕原因。
 */
export function checkOwnerSignup(input: { email: string; ownerEmail: unknown; signupCode: unknown; providedCode: string | null | undefined }): string | null {
  const owner = String(input.ownerEmail ?? "").trim().toLowerCase();
  if (!owner || input.email.trim().toLowerCase() !== owner) return "這個網站只開放擁有者帳號註冊";
  const expected = String(input.signupCode ?? "").trim();
  if (expected && !sameString(expected, String(input.providedCode ?? "").trim())) return "註冊碼不正確";
  return null;
}

/** 長度不同也照樣比完，避免用回應時間猜註冊碼。 */
function sameString(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

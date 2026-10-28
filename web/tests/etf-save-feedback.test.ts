import assert from "node:assert/strict";
import { test } from "node:test";
import { nodes, pageWithAction } from "./helpers/etf-page.ts";

for (const [status, message] of [[400, "每月金額至少 1 元"], [401, "登入狀態已過期，請重新登入"]] as const) {
  test(`儲存預設的 HTTP ${status} 顯示伺服器具體錯誤`, async () => {
    const ui = pageWithAction(async () => ({ ok: false, error: { status, body: { error: message } } }));
    const button = nodes(ui.render()).find((n) => n.type === "button" && n.props.children.includes("設為我的預設"));
    assert.ok(button);
    await (button.props.onClick as () => Promise<void>)();
    const alert = nodes(ui.render()).find((n) => n.type === "p" && n.props.role === "alert");
    assert.equal(alert?.props.children.join(""), message);
    assert.deepEqual(ui.visits, [], "失敗時不能導覽或顯示已儲存");
  });
}

test("儲存預設拋出的網路錯誤仍解除 busy 並顯示可見錯誤", async () => {
  const ui = pageWithAction(async () => { throw new Error("連線中斷"); });
  const button = nodes(ui.render()).find((n) => n.type === "button" && n.props.children.includes("設為我的預設"));
  assert.ok(button);
  await (button.props.onClick as () => Promise<void>)();
  const result = nodes(ui.render());
  assert.equal(result.find((n) => n.type === "p" && n.props.role === "alert")?.props.children.join(""), "操作失敗：連線中斷");
  assert.equal(result.find((n) => n.type === "button" && n.props.children.includes("設為我的預設"))?.props.disabled, false);
});

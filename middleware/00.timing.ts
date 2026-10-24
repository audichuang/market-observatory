import { defineMiddleware } from "void";

// 每個回應附上伺服器處理時間（Server-Timing），瀏覽器 DevTools 與 curl 都看得到，方便追載入速度。
export default defineMiddleware(async (c, next) => {
  const start = performance.now();
  await next();
  c.header("Server-Timing", `app;dur=${Math.round(performance.now() - start)}`);
});

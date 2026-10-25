import { defineConfig } from "vite";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";

export default defineConfig({
  // 每次建置一個新編號：頁面快取鍵帶著它，部署新程式後不會拿到舊程式算好的資料。
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  plugins: [
    voidPlugin(),
    voidReact({ react: { compiler: true } }),
  ],
});

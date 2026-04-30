import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "localhost",
    port: 8080,
    historyApiFallback: true,
    // WSL2 cannot reliably watch /mnt/c via inotify; fall back to polling so
    // edits made from either side trigger HMR.
    watch: { usePolling: true, interval: 300 },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "prompt", // Avisa o usuário quando há update (em vez de atualizar silenciosamente)
      injectRegister: "auto",
      includeAssets: [
        "favicon.ico",
        "robots.txt",
        "icons/apple-touch-icon.png",
        "logo-fdg-premium.png",
      ],
      manifest: {
        name: "FDG Pronta Resposta",
        short_name: "FDG",
        description:
          "Sistema profissional de gestão de chamados para serviços de pronta resposta",
        theme_color: "#1a1f2e",
        background_color: "#1a1f2e",
        display: "standalone",
        orientation: "portrait",
        start_url: "/dashboard",
        scope: "/",
        lang: "pt-BR",
        icons: [
          {
            src: "icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icons/pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Pré-cacheia todos os assets do build
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Exclui o logo original pesado (não usado no app) do precache
        globIgnores: ["**/logo-fdg.png"],
        // Aumenta limite para 4MB (padrão 2MB)
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // Rotas de navegação sempre servem o index.html (SPA)
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/supabase/],
        // Estratégia: rede primeiro para API, cache para assets
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        enabled: false, // Desabilitado em dev para não interferir no HMR
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `firebase-admin` ya viene en la lista por defecto de Next, pero lo declaramos
  // explicitamente junto a `@google/genai` para evitar que Turbopack los empaquete.
  serverExternalPackages: ["firebase-admin", "@google/genai"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;





import nextConfig from "eslint-config-next";
import nextTypescriptConfig from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextConfig,
  ...nextTypescriptConfig,
  {
    ignores: [
      "dist/",
      "node_modules/",
      ".next/",
      ".vercel/",
      "api/",
      "daemon.ts",
      "*.config.mjs",
      "*.config.ts",
    ],
  },
];

export default eslintConfig;

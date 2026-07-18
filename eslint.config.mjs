import next from "eslint-config-next";

/** Flat config — eslint-config-next 16 ships native flat configs we can spread. */
const config = [
  ...next,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },
];

export default config;

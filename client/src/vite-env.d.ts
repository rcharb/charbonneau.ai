/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOGGER: string;
  readonly VITE_LOGGER_FILTER: string;
  // Add other env variables here
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_STRIPE_PRICING_TABLE_ID_LIGHT: string;
  readonly VITE_STRIPE_PRICING_TABLE_ID_DARK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

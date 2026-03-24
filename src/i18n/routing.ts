import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "pt", "fr", "de", "it"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

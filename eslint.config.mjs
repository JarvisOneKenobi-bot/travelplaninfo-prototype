// eslint-config-next@16 already ships a native flat-config array.
// Importing it directly avoids FlatCompat wrapping a config that is
// already in flat format, which causes a circular-reference crash in
// @eslint/eslintrc's config-validator under ESLint 9.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextCoreWebVitals,
];

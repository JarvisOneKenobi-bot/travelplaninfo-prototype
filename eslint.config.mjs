// eslint-config-next@16 already ships a native flat-config array.
// Importing it directly avoids FlatCompat wrapping a config that is
// already in flat format, which causes a circular-reference crash in
// @eslint/eslintrc's config-validator under ESLint 9.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const relaxedReactCompilerRules = nextCoreWebVitals.map((config) => {
  if (!config.rules || !("react-hooks/set-state-in-effect" in config.rules)) return config;
  return {
    ...config,
    rules: {
      ...config.rules,
      // Next 16's React Compiler lint currently flags existing client-side patterns
      // throughout this app as hard errors. Keep the safety signal visible during
      // cleanup, but do not block this planner-governance branch on repo-wide
      // compiler-adoption refactors.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  };
});

export default relaxedReactCompilerRules;

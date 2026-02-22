module.exports = {
  "*.{js,ts,tsx}": [
    "eslint --fix",
    "npm test -- --findRelatedTests --bail --passWithNoTests",
    () => "npm run type-check"
  ]
};

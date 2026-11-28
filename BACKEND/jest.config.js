const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  setupFiles: ["<rootDir>/jest.setup.ts"],
  // dist contiene copias compiladas de los tests y sus mocks no funcionan ahí.
  // Solo se prueba el código fuente de src.
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],

  // Medimos la cobertura sobre TODO el código fuente, no solo sobre los
  // archivos que algún test importa. Sin esto, la cobertura sale inflada.
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/*.test-utils.ts"],
  // text-summary para la consola, lcov para SonarCloud.
  coverageReporters: ["text-summary", "lcov"],

  // Quality gate de cobertura: la suite falla si la cobertura baja de estos
  // valores. Arrancan en la línea base y se suben conforme agregamos pruebas.
  coverageThreshold: {
    global: {
      lines: 43,
      statements: 42,
      branches: 28,
      functions: 39,
    },
  },
};

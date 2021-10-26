module.exports = {
  roots: ['<rootDir>/src/domain', '<rootDir>/tests'],
  testMatch: ['**/?(*.)+(spec|test).+(ts|tsx|js)'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/*',
    '!src/**/__mocks__/*',
  ],
  coverageDirectory: './coverage',
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    'ts-jest': {
      tsconfig: './tsconfig.test.json',
    },
  },
  coverageThreshold: {
    './src/**/*.ts': {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};

/** @type {import('jest').Config} */
module.exports = {
  // Test environment
  testEnvironment: 'node',

  // File extensions
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Transform files with ts-jest
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.(t|j)s',
    '**/*.(test|spec).(t|j)s',
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],

  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.(t|j)s',
    '!src/**/*.spec.(t|j)s',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Module resolution
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@/middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Run tests in parallel
  maxWorkers: '50%',

  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // TypeScript configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          resolveJsonModule: true,
        },
      },
    },
  },

  // Preset
  preset: 'ts-jest',

  // Roots
  roots: ['<rootDir>/src'],

  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>/src'],

  // Error on deprecated features
  errorOnDeprecated: true,

  // Notify mode
  notify: false,

};

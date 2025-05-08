module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'], // Look for tests in src and a dedicated tests folder
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // For resolving @/ path alias
    // SDK mappings removed to allow standard Node resolution via SDK's 'exports' map
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
        module: 'commonjs' // Force module to commonjs for tests
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'], // For global test setup (e.g., mock environment variables, db connections)
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Add transformIgnorePatterns to ensure @modelcontextprotocol/sdk is transformed by ts-jest if needed
  transformIgnorePatterns: [
    '/node_modules/(?!(@modelcontextprotocol/sdk)/)', // Adjusted to correctly capture the scoped package
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts', // Exclude type definition files
    '!src/index.ts', // Usually, the main entry point might be harder to unit test directly
    '!src/utils/logger.ts', // Logging setup might not need direct unit tests
    '!src/config/index.ts', // Config loading might not need direct unit tests
    '!src/core/mcp-types.ts', // Mostly interfaces and simple classes
  ],
  // A list of reporter names that Jest uses when writing coverage reports
  // coverageReporters: ['json', 'lcov', 'text', 'clover'],
  // An object that configures minimum threshold enforcement for coverage results
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  // Indicates whether each individual test should be reported during the run
  verbose: true,
  // Timeout for each test in milliseconds
  testTimeout: 30000, // Increased timeout to 30 seconds
}; 
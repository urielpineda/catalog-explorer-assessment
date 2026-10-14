module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  moduleFileExtensions: ['js', 'json', 'ts'],
};

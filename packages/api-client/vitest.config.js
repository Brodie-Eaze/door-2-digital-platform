// @type {import('vitest/config').UserConfig}
export default {
  test: {
    // This package currently has no test files — coverage is provided by the
    // integration tests in apps/api. passWithNoTests prevents vitest from
    // exiting 1 when the suite is empty.
    passWithNoTests: true,
  },
};

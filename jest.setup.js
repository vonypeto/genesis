require('@testing-library/jest-dom/extend-expect');

process.env.NEW_RELIC_ENABLED = 'false';
process.env.DEBUG = 'info:*,error:*,warn:*';
jest.setTimeout(120000);

# Broker

Guide for adding, modifying, or removing a broker.

## Adding a broker

1. Add the broker URL to `src/constants/brokers.ts` in the `BROKER` object
2. Update `README.md`: Built-in Brokers section
3. Update `llms.txt`: Enums section (BROKER list)
4. Add a test for the new broker URL in `tests/constants.test.ts`

## Modifying a broker

1. Update the URL in `src/constants/brokers.ts`
2. Update `README.md`: Built-in Brokers section
3. Update `llms.txt`: Enums section (BROKER list)
4. Update the test in `tests/constants.test.ts`

## Removing a broker

1. Remove the entry from `src/constants/brokers.ts`
2. Update `README.md`: Built-in Brokers section
3. Update `llms.txt`: Enums section (BROKER list)
4. Remove the test from `tests/constants.test.ts`

# Domain

Guide for adding, modifying, or removing a domain module.

## Adding a domain

1. Create the domain folder: `src/domains/{name}/`
2. Create `{name}.types.ts` with namespace pattern:
   ```typescript
   export namespace {Name} {
     export interface ... { }
   }
   ```
3. Create `{name}.ts` with implementation functions that take `ClientContext` as first param
4. Create `index.ts` with barrel exports
5. Re-export from `src/domains/index.ts`
6. Add public method(s) to `src/client.ts` with JSDoc comment
7. Add example script in `examples/`
8. Add npm script in package.json for the example
9. Add unit test in `tests/`
10. Update `README.md`: Features checklist, API section, Examples section
11. Update `llms.txt` with the new method(s)

## Modifying a domain

1. Update the implementation in `src/domains/{name}/{name}.ts`
2. Update types in `src/domains/{name}/{name}.types.ts` if signatures changed
3. Update the public method(s) and JSDoc in `src/client.ts`
4. Update the example script in `examples/`
5. Update or add tests in `tests/`
6. Update `README.md`: Features checklist, API section, Examples section
7. Update `llms.txt` to reflect the current API

## Removing a domain

1. Delete the domain folder: `src/domains/{name}/`
2. Remove the re-export from `src/domains/index.ts`
3. Remove the public method(s) and import from `src/client.ts`
4. Delete the example script from `examples/`
5. Remove the npm script from package.json
6. Remove or update tests in `tests/`
7. Update `README.md`: Features checklist, API section, Examples section
8. Update `llms.txt` to remove the method(s)

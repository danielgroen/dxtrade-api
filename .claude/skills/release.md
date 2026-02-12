# Release

Publishing is automated. When a PR is squash-merged to master, the publish workflow:

1. Bumps the patch version in package.json
2. Publishes to npm with OIDC provenance
3. Creates a GitHub Release with auto-generated notes

## Manual version bumps

For minor or major releases, bump the version locally before merging:

```bash
npm version minor --no-git-tag-version
# or
npm version major --no-git-tag-version
```

Then commit the version change and merge the PR. The workflow will skip the auto-bump if the version already changed.

# Releasing signalJourney

A release is a pull request that sets the version and the changelog, followed by one tag push.
Everything after the tag push is automatic, and `scripts/release_check.py` is the one place the rules live: CI and the publish workflow both call it, and `tests/test_release_check.py` tests it.

## The rules

- **Tags are exactly `vX.Y.Z`**, digits only.
  `v0.2`, `0.2.0` and `v0.2.0-rc1` are refused, and a refused tag publishes nothing.
- **The version has one source**: `__version__` in `src/signaljourney_validator/__init__.py`.
  `pyproject.toml` declares `dynamic = ["version"]` and reads it, so one edit per release cannot drift.
- **The tag equals `v` + `__version__`**, which equals the version in the built wheel and sdist, and the newest dated entry of `CHANGELOG.md`.
  That entry must not be empty.
- **The GitHub release is titled exactly with the tag** (`v0.2.0`), and its notes are the changelog entry.
- **A tag is never moved, reused or deleted.**
  To fix a bad release, release the next version.
  An existing PyPI file name can never be uploaded again, so a reused version cannot be published even if the tag could be.
- **Every code change updates the changelog.**
  A pull request that touches `src/`, `pyproject.toml` or `MANIFEST.in` must change `CHANGELOG.md` inside `## [Unreleased]`, or carry the label `no-changelog`.
  The `Changelog` workflow checks this, and it also requires the Keep a Changelog headings (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) and an untouched `0.1.0` section, which predates these rules and is frozen.

## Making a release

1. In a pull request into `main`, move the contents of `## [Unreleased]` under a new heading `## [X.Y.Z] - YYYY-MM-DD` (today's date), leave `## [Unreleased]` in place and empty above it, and set `__version__ = "X.Y.Z"`.
   Choose the number by [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
2. Check it locally:
   ```bash
   uv run python scripts/release_check.py static
   uv run python scripts/release_check.py notes X.Y.Z      # the release notes
   uv build && uv run python scripts/release_check.py tag vX.Y.Z --dist dist/
   uv run --with pytest --with pytest-cov pytest tests/test_release_check.py -q
   ```
3. Merge the pull request once `Continuous Integration` and `Changelog` are green.
4. Tag the merge commit and push the tag, from an up-to-date `main`:
   ```bash
   git tag -a vX.Y.Z -m vX.Y.Z <merge commit>
   git push origin vX.Y.Z
   ```

## What the tag push does

`.github/workflows/publish.yml` runs these jobs in order; each needs the one before it.

| Job | What it does |
|---|---|
| `check` | The tagged commit is on `main`, and `release_check.py tag` passes. |
| `build` | `uv build`, a check that the installed wheel carries every schema file and validates an example, `release_check.py tag --dist dist/`, and an upload of `dist/`. |
| `testpypi` | Publishes `dist/` to TestPyPI (environment `testpypi`). |
| `smoke-testpypi` | In a fresh virtual environment, installs `signalJourney==X.Y.Z` from TestPyPI with `--no-deps`, installs `jsonschema` and `click` from PyPI, then validates a packaged example. It retries up to 5 times, 30 seconds apart, while the index catches up. No dependency ever comes from TestPyPI. |
| `pypi` | Publishes the same `dist/` to PyPI (environment `pypi`). |
| `release` | Creates the GitHub release with `--title "$TAG"` and the changelog entry as notes. This is the only job that can write to the repository. |

Publishing uses trusted publishing, so no token is stored.
Both indexes must have `publish.yml` registered as a trusted publisher of the project `signalJourney`, with the environments `testpypi` and `pypi`.

## When a run stops half way

Use **Re-run failed jobs**, not **Re-run all jobs**: the finished jobs keep their results, whereas a full re-run would upload the same files to PyPI a second time, which PyPI refuses.

- **`check` or `build` failed.** Nothing was published.
  Fix the cause on `main` through a pull request, then release the next version, because a tag is never moved.
- **`testpypi` or `smoke-testpypi` failed.** PyPI has not been touched.
  If the cause is a transient index delay, re-run the failed job.
  Otherwise fix it and release the next version; TestPyPI may keep the failed version.
- **`pypi` failed.** Re-run it after the cause is gone.
  If PyPI refuses the files as already existing, the version is already on PyPI, and the `release` job was skipped.
  Create the release by hand with the same title and notes:
  ```bash
  uv run python scripts/release_check.py notes X.Y.Z > notes.md
  gh release create vX.Y.Z --title vX.Y.Z --notes-file notes.md --verify-tag
  ```
- **`release` failed.** Re-run it: an existing release is edited to the same title and notes, so the result is the same.

A version published to PyPI cannot be replaced.
A broken release is yanked on PyPI and superseded by the next version.

## Recommended repository settings

These belong to the repository owner; nothing in the workflows changes them.

- A tag ruleset on `v*` (pattern `v[0-9]*.[0-9]*.[0-9]*`) that limits creation to maintainers and blocks update and deletion.
- Required reviewers on the `pypi` environment, so a tag push waits for a person before anything reaches PyPI.
- A `main` ruleset that requires the `Continuous Integration` jobs and the `Changelog` check.
- Trusted publishers registered for `publish.yml` with the environments `testpypi` and `pypi`.

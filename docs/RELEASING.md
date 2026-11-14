# Releasing signalJourney

A release is a pull request that sets the version and the changelog, followed by one tag push.
Everything after the tag push is automatic, and `scripts/release_check.py` is the one place the rules live: CI and the publish workflow both call it, and `tests/test_release_check.py` tests it.

## The rules

- **Tags are exactly `vX.Y.Z`**, digits only.
  `v0.2`, `0.2.0` and `v0.2.0-rc1` are refused, and a refused tag publishes nothing.
- **The version has one source**: `__version__` in `src/signaljourney_validator/__init__.py`.
  `pyproject.toml` declares `dynamic = ["version"]` and reads it, so one edit per release cannot drift.
- **The tag equals `v` + `__version__`**, which equals the version in the built wheel and sdist, and the newest dated entry of `CHANGELOG.md`.
  That entry must not be empty, and `## [Unreleased]` must be empty, so nothing unreleased can ship under a tagged version's notes.
  The changelog structure and the `pyproject.toml` version rules are checked again at tag time.
- **The GitHub release is titled exactly with the tag** (`v0.2.0`), and its notes are the changelog entry.
- **A tag is never moved, reused or deleted.**
  To fix a bad release, release the next version.
  An existing PyPI file name can never be uploaded again, so a reused version cannot be published even if the tag could be.
- **Every code change updates the changelog.**
  A pull request that touches `src/`, `pyproject.toml` or `MANIFEST.in` must change `CHANGELOG.md` inside `## [Unreleased]`, or carry the label `no-changelog`.
  The `Changelog` workflow checks this (moving a file out of `src/` counts as a change), and it also requires the Keep a Changelog headings (`Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`) and an untouched `0.1.0` section, which predates these rules and is frozen.

## Making a release

1. In a pull request into `main`, move the contents of `## [Unreleased]` under a new heading `## [X.Y.Z] - YYYY-MM-DD` (today's date), leave `## [Unreleased]` in place and empty above it, and set `__version__ = "X.Y.Z"`.
   Choose the number by [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
2. Check it locally:
   ```bash
   uv run python scripts/release_check.py static
   uv run python scripts/release_check.py notes X.Y.Z      # the release notes
   uv build && uv run python scripts/release_check.py tag vX.Y.Z --dist dist/   # needs [Unreleased] empty
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
| `smoke-testpypi` | First requires every file in `dist/` to have the same sha256 as the file TestPyPI holds for that version (`release_check.py digests`); a difference fails the run at once. Then, in a fresh virtual environment, installs `signalJourney==X.Y.Z` from TestPyPI with `--no-deps`, installs the package's own `Requires-Dist` from PyPI, runs `uv pip check`, and validates a packaged example. It retries up to 5 times, 30 seconds apart, only while the index does not list the files yet. No dependency ever comes from TestPyPI. |
| `pypi` | Publishes the same `dist/` to PyPI (environment `pypi`). |
| `release` | Creates the GitHub release with `--title "$TAG"` and the changelog entry as notes. This is the only job that can write to the repository. |

Publishing uses trusted publishing, so no token is stored.
Both indexes must have `publish.yml` registered as a trusted publisher of the project `signalJourney`, with the environments `testpypi` and `pypi`.

## When a run stops half way

Use **Re-run failed jobs**, not **Re-run all jobs**.
Builds are not reproducible, so a full re-run builds different bytes: TestPyPI keeps the first upload of each file (`skip-existing`), and PyPI refuses a second upload of a file name, so the files could no longer be the ones that were smoke-tested.
The digest comparison in `smoke-testpypi` exists to catch exactly that, and it fails closed.
Finished jobs keep their results and their `dist` artifact, which is why a failed-job re-run is safe.

- **`check` or `build` failed.** Nothing was published.
  Fix the cause on `main` through a pull request, then release the next version, because a tag is never moved.
- **`testpypi` failed.** PyPI has not been touched.
  Re-run the failed job; if it cannot succeed, fix the cause and release the next version.
- **`smoke-testpypi` failed on a digest mismatch.** TestPyPI holds other bytes than this run built, usually because an earlier run of the same tag uploaded first.
  Nothing reached PyPI, and it must not: bump the version through a release pull request and push a new tag.
  Never re-tag, and never retry past a mismatch.
- **`smoke-testpypi` failed for another reason** (an index delay beyond the retries, a broken install).
  PyPI has not been touched.
  Re-run the failed job for a delay; otherwise fix the cause and release the next version, and TestPyPI may keep the failed version.
- **`pypi` failed.** Re-run the failed job after the cause is gone.
  If PyPI reports that files already exist, check what it holds: `https://pypi.org/project/signaljourney/X.Y.Z/#files`.
  - *Everything was uploaded* (the wheel and the sdist, with the digests of the `dist` artifact): the version is complete and the `release` job was skipped; create the release by hand.
  - *Only one file was accepted* (for example the wheel, not the sdist): the version cannot be completed, because PyPI never accepts a file name twice and a rebuilt file would differ from the smoke-tested one.
    Yank that version on PyPI with a note that it is incomplete, and release the next version.
    Do not upload the missing file by hand.
  To create the release by hand with the same title and notes:
  ```bash
  uv run python scripts/release_check.py notes X.Y.Z > notes.md
  gh release create vX.Y.Z --title vX.Y.Z --notes-file notes.md --verify-tag
  ```
- **`release` failed.** Re-run the failed job: an existing release is edited to the same title and notes, so the result is the same.

A version published to PyPI cannot be replaced.
A broken release is yanked on PyPI and superseded by the next version.

## How the checks are protected

The `Changelog` workflow runs the base branch's copy of `scripts/release_check.py` against a pull request, with `python3 -I` so a file in the checkout cannot shadow the standard library.
That is a convenience and not a security boundary.
Under `pull_request` GitHub runs the pull request's own copy of the workflow file, so a pull request that edits `changelog.yml` can change or skip the step, and one that edits the script is judged by the base copy only while the workflow is left alone.
The pull request's own copy of the script is exercised by its tests in `Continuous Integration`, which the same pull request can also edit.
The first pull request that introduces the script has no base copy, and is judged by its own.

What enforces the rules is the repository: a ruleset on `main` that requires the `Changelog` and `Continuous Integration` checks and a review from the code owners of `.github/workflows/` and `scripts/release_check.py` (add those paths to a `CODEOWNERS` file and turn on "Require review from Code Owners").
Without that review, the checks stop mistakes, not a determined change to the checks themselves.

## Recommended repository settings

These belong to the repository owner; nothing in the workflows changes them.

- A tag ruleset on `v*` (pattern `v[0-9]*.[0-9]*.[0-9]*`) that limits creation to maintainers and blocks update and deletion.
- Required reviewers on the `pypi` environment, so a tag push waits for a person before anything reaches PyPI.
- A `main` ruleset that requires the `Continuous Integration` jobs and the `Changelog` check, and requires a code-owner review of `.github/workflows/` and `scripts/release_check.py` (with those paths in `CODEOWNERS`).
- Trusted publishers registered for `publish.yml` with the environments `testpypi` and `pypi`.

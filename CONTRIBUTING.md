# Contributing to Signal Journey

Thank you for your interest in contributing to the Signal Journey specification!

## How to Contribute

We welcome contributions in various forms:

*   **Reporting Bugs:** If you find an error in the specification, schema, or examples, please open an issue on the [GitHub repository](https://github.com/signal-journey/specification/issues).
*   **Suggesting Enhancements:** Have an idea for improving the specification or adding a new feature? Open an issue to start a discussion.
*   **Improving Documentation:** Notice typos, unclear explanations, or missing information? Submit a pull request with your suggested changes.
*   **Adding Examples:** Create new example `signalJourney.json` files for different use cases and submit them via a pull request.
*   **Proposing New Namespaces:** See the dedicated section below.

## Pull Request Process

1.  Fork the repository.
2.  Create a new branch for your changes (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Ensure your changes adhere to the project's style and standards.
5.  If modifying the schema, validate it against the meta-schema and ensure examples still validate.
6.  Commit your changes (`git commit -am 'feat: Add some feature'`).
7.  Push to your branch (`git push origin feature/your-feature-name`).
8.  Open a pull request against the `main` branch of the original repository.
9.  Clearly describe your changes in the pull request description.

## Proposing New Namespaces

The Signal Journey specification uses namespaces under the `extensions` property to allow for domain-specific information (e.g., `eeg`, `nemar`). To maintain consistency and avoid conflicts, adding new top-level namespaces requires a formal proposal process.

**Before Proposing:**

*   **Review Existing Namespaces:** Check if the information you need can reasonably fit within the `core` fields or existing reserved namespaces (`eeg`, `nemar`). See [`docs/namespaces.md`](docs/namespaces.md) for details.
*   **Consider Scope:** Is the proposed namespace broadly applicable to a community or tool, or is it highly specific to a single project?

**Proposal Process:**

1.  **Discussion:** Open a GitHub issue with the label `namespace-proposal` to discuss the need, scope, and potential structure of the new namespace.
2.  **Formal Proposal (Pull Request):** If the initial discussion shows promise, create a pull request that includes:
    *   An update to [`docs/namespaces.md`](docs/namespaces.md) detailing the proposed namespace (purpose, scope, maintainer).
    *   (Recommended) A draft JSON schema definition for the namespace's structure.
    *   Clear justification addressing the guidelines mentioned in [`docs/namespaces.md`](docs/namespaces.md).
3.  **Review:** The maintainers will review the proposal based on clarity, justification, scope, potential conflicts, and community need.
4.  **Decision:** The proposal will be approved, rejected, or sent back for revisions.
5.  **Integration (If Approved):** The documentation will be merged, and the namespace may be formally added to the main schema properties in a future release.

We aim for a collaborative process. Please engage in the discussion phase before submitting a formal pull request.

## Code of Conduct

Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms. *(Link to Code of Conduct TBD)* 
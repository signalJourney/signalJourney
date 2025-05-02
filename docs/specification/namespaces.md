# Signal Journey Namespaces

## Purpose

The Signal Journey specification utilizes namespaces within the top-level `extensions` object to accommodate domain-specific or tool-specific metadata without cluttering the core schema definition. This allows for flexibility while maintaining a standardized base structure.

## Reserved Namespaces

The following namespaces are currently defined and **reserved**:

*   **`core` (Implied):** Properties defined directly within the main schema body (not under `extensions`) belong to the core namespace. These represent fundamental concepts applicable across domains.
*   **`eeg`:** Reserved for properties specifically related to Electroencephalography (EEG) data, processing, and metadata (e.g., channel locations, reference schemes, specific artifact types). This namespace is primarily managed in coordination with EEG-focused communities and tools.
*   **`nemar`:** Reserved for properties related to the Neuroelectromagnetic Data Archive and Tools Resource (NEMAR) project, such as specific pipeline identifiers or project metadata required by NEMAR.

These reserved namespaces are managed by the core Signal Journey maintainers and associated projects (like NEMAR, EEGLAB). Changes or additions within these namespaces follow the project's internal governance.

## Using Extensions

To add information specific to a domain like EEG, you would place it within the corresponding namespace object under `extensions`:

```json
{
  // ... core properties ...
  "extensions": {
    "eeg": {
      "channelLocationsFile": "/path/to/standard_1020.elc",
      "referenceChannels": ["TP9", "TP10"],
      "percentBadEpochs": 5.2
    },
    "nemar": {
      "nemarPipelineId": "uuid-1234-abcd-5678"
    }
    // Potentially other approved namespaces here
  }
}
```

## Proposing a New Namespace

Adding new top-level namespaces (e.g., `meg`, `fnirs`, `myToolX`) requires a formal proposal and review process to ensure consistency, avoid redundancy, and maintain the integrity of the specification.

**Proposal Guidelines:**

1.  **Justification:** Clearly explain the need for the new namespace. Why can't existing core fields or reserved namespaces accommodate the required information? What specific domain, tool, or data type does it represent?
2.  **Scope:** Define the intended scope and types of properties the namespace will contain.
3.  **Schema (Optional but Recommended):** Provide a draft JSON schema definition for the proposed namespace object. This helps clarify the structure and data types.
4.  **Maintainer:** Identify a point person or group responsible for maintaining the namespace definition.
5.  **Community Support:** Demonstrate potential utility or adoption within a relevant community or for a specific tool.

**Process:**

1.  **Discuss:** Open an issue on the Signal Journey GitHub repository to discuss the proposed namespace.
2.  **Formal Proposal:** If the initial discussion is positive, submit a formal proposal as outlined in the main [`CONTRIBUTING.md`](../../CONTRIBUTING.md) guide (usually via a Pull Request modifying documentation or a dedicated proposal document).
3.  **Review:** The proposal will be reviewed by the Signal Journey maintainers based on the guidelines above.
4.  **Approval & Integration:** If approved, the namespace will be officially recognized, documented, and potentially added to the main schema's `extensions.properties` list in a future release.

Please refer to [`CONTRIBUTING.md`](../../CONTRIBUTING.md) for the most up-to-date details on the contribution and proposal process. 
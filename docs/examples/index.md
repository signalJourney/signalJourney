# signalJourney Examples

Welcome to the signalJourney examples! These examples demonstrate how to document signal processing pipelines using the signalJourney specification. Each example includes a detailed breakdown of the JSON structure and showcases different features of the format.

## Example Categories

### 📚 Schema Examples
These examples are found in the [`schema/examples/`](https://github.com/neuromechanist/signalJourney/tree/main/schema/examples) directory and demonstrate core signalJourney features:

| Example | Pipeline Type | Key Features | Software |
|---------|---------------|--------------|----------|
| [Basic Preprocessing](./basic_preprocessing.md) | Linear preprocessing | File I/O, step dependencies, quality metrics | MNE-Python |
| [ICA Decomposition](./ica_decomposition.md) | Artifact removal | Pipeline chaining, multiple outputs, cross-step references | MNE-Python |
| [Connectivity Analysis](./connectivity.md) | Network analysis | Parallel processing, multiple metrics | MNE-Python |
| [Source Localization](./source_localization.md) | Source modeling | Forward/inverse modeling, anatomical integration | MNE-Python |
| [Time-Frequency Analysis](./time_frequency.md) | Spectral analysis | Frequency decomposition, statistical testing | MNE-Python |

### 🏭 Real-World Examples
Complete, production-ready pipeline documentation from actual research workflows:

| Example | Description | Features |
|---------|-------------|----------|
| [NEMAR Pipeline](./real_world/nemar_pipeline.md) | EEGLAB-based preprocessing for OpenNeuro | 12-step workflow, inline data, quality assessment |

## What You'll Learn

### Basic Concepts
- **Pipeline metadata** - How to document pipeline information, versions, and execution context
- **Processing steps** - Structure for documenting individual processing stages
- **Input/output specification** - Tracking data flow between steps
- **Parameter documentation** - Preserving all settings for reproducibility

### Advanced Features
- **Pipeline chaining** - Linking outputs from one pipeline as inputs to another
- **Multiple output types** - In-memory objects, saved files, variables, and inline data
- **Quality metrics** - Step-level and pipeline-level quality assessment
- **Cross-step dependencies** - Complex data flows with multiple inputs per step

### Data Flow Patterns
- **Linear pipelines** - Sequential processing (basic preprocessing)
- **Branching workflows** - Parallel processing streams (connectivity analysis)
- **Integration patterns** - Combining results from multiple sources (source localization)
- **Iterative processes** - Optimization and refinement loops

## Visual Documentation

Each example includes **mermaid flowcharts** that visualize:
- 🔷 **Processing steps** (blue boxes)
- 📁 **Input files** (orange boxes)  
- 💾 **Output files** (green boxes)
- 📊 **Inline data** (purple boxes)
- ➡️ **Data flow** (arrows showing dependencies)

These flowcharts make it easy to understand pipeline structure at a glance.

## Getting Started

1. **Start with [Basic Preprocessing](./basic_preprocessing.md)** to understand fundamental concepts
2. **Explore [ICA Decomposition](./ica_decomposition.md)** to see pipeline chaining
3. **Check out other examples** based on your analysis needs
4. **Review [NEMAR Pipeline](./real_world/nemar_pipeline.md)** for a complete real-world example

## JSON Schema Reference

All examples validate against the signalJourney JSON schema. For detailed field specifications, see:
- [Schema Overview](../specification/overview.md)
- [Field Definitions](../specification/fields.md)
- [Validation Guide](../specification/validation.md)

## Contributing Examples

Have a pipeline you'd like to document as an example? See our [contributing guide](../contributing.md) for how to add new examples to the collection.

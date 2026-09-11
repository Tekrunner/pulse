# Pulse visual language

Use `site/design/tokens.css` for dark-default semantic colour, typography,
spacing, focus, state, and motion roles. Use roles such as `--color-text` and
`--color-error`; keep a series palette, chart geometry, and report layout local
to the purpose-built visual that needs them.

Every visual is container-responsive, has a text data equivalent and visible
provenance, and remains keyboard-operable with a visible focus indicator.
Loading, empty, warning, and error states use a named text cue and an additional
non-colour cue. Respect `prefers-reduced-motion`; do not use motion as the only
signal.

The `docs/visual-contract-v1.md` Visual Contract v1 is the renderer boundary.
Start new work from `site/workflows/add-visual/template/`, whose synthetic
fixture is intentionally not an exemplar visual. This guidance does not select
chart types, impose a report layout, prescribe content, or create a component
catalogue.

Before adding a token, show that it serves more than one existing consumer and
run every shared-role consumer's conformance coverage. Changing a shared role
must not restyle unrelated reports; one-off choices remain local.

## Reference harness

`/design/reference` is a developer-facing conformance reference, not a public
report page and not a visual-design recommendation. It is intentionally absent
from report navigation. Before authoring or changing a visual, use it to check
the neutral template's baseline: indicator, provenance, keyboard interaction,
visible focus, accessible data equivalent, responsive container behavior, and
named non-colour states. It lets authors and reviewers validate those shared
requirements without reading or copying an existing report visual.

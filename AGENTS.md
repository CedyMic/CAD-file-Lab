# CAD File Lab product and UI directives

These requirements apply to every implementation and review in this repository.

## Product interaction model

- Use SolidWorks-style desktop CAD interaction patterns as the default reference, adapted only where browser limitations require it.
- Keep the main graphics area dominant. Commands belong in a compact CommandManager, structure/history in the FeatureManager tree, and active parameters in a PropertyManager.
- Sketch and Features are separate contextual command tabs. Measure has its own contextual toolbar and docked results panel.
- Never expose a control as complete unless its underlying geometry operation works and is tested.

## Density and space

- Optimize for desktop CAD information density, not landing-page or mobile-card sizing.
- Standard command controls should be 28-34 px tall. Avoid oversized cards, headings, padding, and full-width buttons.
- Setup flows such as plane selection must use compact floating or docked panels; they must not replace the graphics area with a large form.
- Prefer one-row tool groups, small icons with short labels, compact fields, and collapsible advanced options.
- Before shipping any UI, inspect it at 1366x768 and verify that toolbars are fully visible, do not clip, and leave most space to the model or sketch.

## CAD behavior review

- Research the current official SOLIDWORKS Design Help before implementing each CAD workflow. Use official behavior as acceptance criteria and image references only for visual placement/density.
- Verify continuous tool behavior, live previews, snapping/inference, selection feedback, Escape semantics, undo/redo, editable dimensions, and FeatureManager history.
- Compare workflows to the equivalent SolidWorks command before implementation and before deployment.
- Preserve compactness and familiar CAD behavior across all future features without requiring the user to repeat this direction.

# Reading Hut Panel Horizontal Drag Design

## Scope

Add horizontal drag/swipe interaction to the shared `.bag-item-list` used by both the furniture and decoration panels. Do not add visible arrows or change the Figma layout.

## Interaction

- Keep native horizontal overflow and touch momentum scrolling.
- Add Pointer Events so mouse, pen, and touch input share one drag implementation.
- Start a drag only after horizontal movement exceeds 6px.
- While dragging, update `scrollLeft` from the pointer delta and show a grabbing cursor.
- Capture the active pointer until release or cancellation.
- Suppress the click immediately following a real drag so cards do not activate accidentally.
- Preserve normal card clicks when movement stays below the threshold.
- Reset `scrollLeft` to zero whenever a panel category is rendered.

## Accessibility and Motion

- Keep existing keyboard focus and click behavior.
- Do not add animation or forced scroll snapping.
- Use `touch-action: pan-y` so vertical gestures remain available while horizontal movement is handled by the list.

## Tests

- Verify the shared list has the drag cursor and touch-action CSS.
- Verify pointer down/move/up/cancel handlers are installed once on the shared list.
- Verify the 6px threshold, pointer capture, `scrollLeft` update, and post-drag click suppression are present.
- Run all existing tests after implementation.

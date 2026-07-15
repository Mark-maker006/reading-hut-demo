# Star Exchange Dialog Design

## Scope

Add one reusable exchange dialog to `reading-hut.html`, matching Figma nodes `219:1899` and `219:1905`. It is opened by clicking any locked item card in either bag category.

## State and Decision

- Read the initial balance from `.room-star-count` (`30`).
- If `balance >= item.stars`, open the sufficient dialog.
- If `balance < item.stars`, open the insufficient dialog.
- State is in memory only and resets on page refresh.

## Successful Exchange

- Deduct the price from the balance.
- Update the top-bar number and accessible label.
- Set the item object's `unlocked` field to `true`.
- Change the visible card thumbnail to the colored `img` asset and set `data-state="on"`.
- Close the dialog and keep the bag panel open.

## Dialog Actions

- `再想想` and `暂不兑换`: close the dialog.
- `确认兑换`: execute the exchange.
- `去完成计划`: close the dialog and bag, then reveal the existing study tip.

## Visual Structure

- Dialog: `341×446`, centered in the `393×852` room.
- Main content: `262×382` at `(40,31)` for sufficient and `(40,32)` for insufficient.
- Buttons: left `123×44`, right `127×46`, 12px gap.
- Reproduce all title, preview, dashed rows, typography, colors, radii, borders, and shadows from the Figma Inspector values.
- Use a transparent interaction-blocking overlay with no invented dimming.
- Store all Figma assets locally; ship no temporary Figma URLs.

## Tests

- Verify both Figma modes and exact geometry exist.
- Verify equality uses the sufficient branch.
- Verify confirmation deducts balance, unlocks the item, updates the card and top bar, and closes the dialog.
- Verify insufficient and cancel actions do not mutate the balance.
- Run the full Node test suite and validate inline JavaScript syntax.

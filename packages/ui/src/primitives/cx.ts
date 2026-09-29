// Joins class names, dropping empty ones. Shared by the primitives because
// every one of them appends a caller's `className` to its own module class
// (specs/phase-2/specs.md §2.6), and under Vitest's default `css: false` the
// module class itself may have no value — so a plain template string would
// render the word "undefined" into the markup.
export const cx = (...names: (string | false | null | undefined)[]) =>
  names.filter(Boolean).join(' ')

// The standard checklist every job gets when a property has no custom
// template. Lives in its own file (no server imports) so client components
// can show it too — the property page displays it as the starting template.
export const DEFAULT_CHECKLIST = [
  { label: "Vacuum all floors", room: "General", order: 0, completed: false },
  { label: "Mop hard floors", room: "General", order: 1, completed: false },
  { label: "Empty all trash cans", room: "General", order: 2, completed: false },
  { label: "Clean bathrooms", room: "Bathroom", order: 3, completed: false },
  { label: "Replace towels and toiletries", room: "Bathroom", order: 4, completed: false },
  { label: "Make all beds with fresh linens", room: "Bedroom", order: 5, completed: false },
  { label: "Clean kitchen counters and appliances", room: "Kitchen", order: 6, completed: false },
  { label: "Final walkthrough", room: "General", order: 7, completed: false },
]

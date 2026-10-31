export const ITEMS = {
  necessities: {
    name: "Groceries & necessities",
    price: 16,
    relief: 9,
    description: "A stocked cupboard and a little breathing room.",
  },
  smokes: {
    name: "Smokes",
    price: 12,
    relief: 5,
    description: "A brief break. No lasting advantage.",
  },
  booze: {
    name: "Booze",
    price: 18,
    relief: 7,
    description: "Unwind for the evening.",
  },
  music: {
    name: "Pocket music player",
    price: 65,
    relief: 16,
    description: "Your own soundtrack. A lasting possession.",
  },
  clothing: {
    name: "Fresh clothes",
    price: 48,
    relief: 8,
    description: "A small luxury. Feel more put together.",
  },
} as const;
export type ItemId = keyof typeof ITEMS;

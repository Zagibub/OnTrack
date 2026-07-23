import type { Meta, StoryObj } from "@storybook/angular-vite";
import { EntryRow } from "./entry-row";

const meta: Meta<EntryRow> = {
  title: "UI/EntryRow",
  component: EntryRow,
  render: (args) => ({
    props: args,
    template: `<div style="max-width:24rem"><ot-entry-row
      [entryId]="entryId" [name]="name" [kcal]="kcal" [timeLabel]="timeLabel"
      [hint]="hint" /></div>`,
  }),
};
export default meta;

type Story = StoryObj<EntryRow>;

export const Default: Story = {
  args: { entryId: 1, name: "Oatmeal with berries", kcal: 350, timeLabel: "08:15" },
};
export const LongName: Story = {
  args: {
    entryId: 2,
    name: "Grilled chicken salad with avocado, feta and a lemon dressing",
    kcal: 620,
    timeLabel: "13:02",
  },
};
/** Hover the row on a pointer device to reveal the trailing trash affordance. */
export const HoverToDelete: Story = {
  args: { entryId: 3, name: "Greek yogurt", kcal: 120, timeLabel: "10:40" },
};
/** One-time swipe hint — plays on touch devices (emulate a touch device to see it). */
export const SwipeHint: Story = {
  args: { entryId: 4, name: "Banana", kcal: 90, timeLabel: "16:20", hint: true },
};

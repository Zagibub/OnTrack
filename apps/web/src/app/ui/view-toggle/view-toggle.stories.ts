import type { Meta, StoryObj } from "@storybook/angular-vite";
import { ViewToggle } from "./view-toggle";

const meta: Meta<ViewToggle> = {
  title: "UI/ViewToggle",
  component: ViewToggle,
  render: (args) => ({
    props: args,
    template: `
      <div style="max-width:20rem">
        <ot-view-toggle [options]="options" [value]="value" (valueChange)="value = $event" />
      </div>
    `,
  }),
};
export default meta;

type Story = StoryObj<ViewToggle>;

const options = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export const Month: Story = { args: { options, value: "month" } };
export const Week: Story = { args: { options, value: "week" } };
export const Day: Story = { args: { options, value: "day" } };

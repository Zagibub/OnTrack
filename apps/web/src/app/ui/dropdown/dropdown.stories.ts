import type { Meta, StoryObj } from "@storybook/angular-vite";
import { Dropdown } from "./dropdown";

const meta: Meta<Dropdown> = {
  title: "UI/Dropdown",
  component: Dropdown,
  render: (args) => ({
    props: args,
    template: `
      <div style="max-width:20rem;padding-bottom:8rem">
        <ot-dropdown [options]="options" [value]="value" (valueChange)="value = $event" />
      </div>
    `,
  }),
};
export default meta;

type Story = StoryObj<Dropdown>;

const options = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

export const Today: Story = { args: { options, value: "today" } };
export const Week: Story = { args: { options, value: "week" } };

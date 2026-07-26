import type { Meta, StoryObj } from "@storybook/angular-vite";
import { Dropdown } from "./dropdown";

const meta: Meta<Dropdown> = {
  title: "UI/Dropdown",
  component: Dropdown,
  render: (args) => ({
    props: args,
    template: `
      <div style="max-width:20rem;padding-bottom:8rem">
        <ot-dropdown
          [options]="options"
          [value]="value"
          [variant]="variant"
          [placeholder]="placeholder"
          (valueChange)="value = $event"
        />
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

export const Today: Story = {
  args: { options, value: "today", variant: "heading", placeholder: "" },
};
export const Week: Story = {
  args: { options, value: "week", variant: "heading", placeholder: "" },
};

/** The form-control look, unselected: the placeholder stands in for a label (011). */
export const FieldPlaceholder: Story = {
  args: {
    options: [
      { value: "running", label: "Running" },
      { value: "cycling", label: "Cycling" },
      { value: "other", label: "Other" },
    ],
    value: "",
    variant: "field",
    placeholder: "Choose an activity",
  },
};

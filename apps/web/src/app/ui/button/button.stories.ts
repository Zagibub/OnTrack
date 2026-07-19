import type { Meta, StoryObj } from "@storybook/angular-vite";
import { Button } from "./button";

const meta: Meta<Button> = {
  title: "UI/Button",
  component: Button,
  render: (args) => ({
    props: args,
    template: `<ot-button [variant]="variant" [disabled]="disabled">Log meal</ot-button>`,
  }),
  argTypes: {
    variant: { control: "select", options: ["primary", "secondary", "danger"] },
  },
};
export default meta;

type Story = StoryObj<Button>;

export const Primary: Story = { args: { variant: "primary", disabled: false } };
export const Secondary: Story = { args: { variant: "secondary", disabled: false } };
export const Danger: Story = { args: { variant: "danger", disabled: false } };
export const Disabled: Story = { args: { variant: "primary", disabled: true } };

import type { Meta, StoryObj } from "@storybook/angular-vite";
import { Chevron } from "./chevron";

const meta: Meta<Chevron> = {
  title: "UI/Chevron",
  component: Chevron,
  render: (args) => ({
    props: args,
    template: `<span style="color: var(--color-primary)"><ot-chevron [size]="size" /></span>`,
  }),
};
export default meta;

type Story = StoryObj<Chevron>;

export const Default: Story = { args: { size: 16 } };
export const Large: Story = { args: { size: 44 } };

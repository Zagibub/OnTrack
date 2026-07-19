import type { Meta, StoryObj } from "@storybook/angular-vite";
import { TextField } from "./text-field";

const meta: Meta<TextField> = {
  title: "UI/TextField",
  component: TextField,
  argTypes: {
    kind: { control: "select", options: ["text", "number"] },
  },
};
export default meta;

type Story = StoryObj<TextField>;

export const Text: Story = {
  args: { label: "Food name", kind: "text", placeholder: "e.g. Oatmeal", error: null },
};

export const NumberEntry: Story = {
  args: { label: "Calories (kcal)", kind: "number", placeholder: "450", error: null },
};

export const WithError: Story = {
  args: { label: "Calories (kcal)", kind: "number", error: "Please enter a number" },
};

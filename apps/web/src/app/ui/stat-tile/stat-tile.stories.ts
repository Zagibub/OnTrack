import type { Meta, StoryObj } from "@storybook/angular-vite";
import { StatTile } from "./stat-tile";

const meta: Meta<StatTile> = {
  title: "UI/StatTile",
  component: StatTile,
};
export default meta;

type Story = StoryObj<StatTile>;

export const Intake: Story = { args: { label: "Eaten", value: 1450, unit: "kcal" } };
export const Balance: Story = { args: { label: "Balance", value: -250, unit: "kcal" } };
export const NoUnit: Story = { args: { label: "Entries", value: 7, unit: null } };

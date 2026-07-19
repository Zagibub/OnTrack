import type { Meta, StoryObj } from "@storybook/angular-vite";
import { BarChart } from "./bar-chart";

const meta: Meta<BarChart> = {
  title: "UI/BarChart",
  component: BarChart,
};
export default meta;

type Story = StoryObj<BarChart>;

export const WeeklyIntake: Story = {
  args: {
    description: "kcal per day this week",
    target: 2000,
    data: [
      { label: "Mon", value: 1850 },
      { label: "Tue", value: 2400 },
      { label: "Wed", value: 1700 },
      { label: "Thu", value: 2100 },
      { label: "Fri", value: 2650 },
      { label: "Sat", value: 1900 },
      { label: "Sun", value: 1500 },
    ],
  },
};

export const NoTarget: Story = {
  args: {
    description: "kcal per day",
    target: null,
    data: [
      { label: "Mon", value: 1850 },
      { label: "Tue", value: 2400 },
      { label: "Wed", value: 1700 },
    ],
  },
};

export const Empty: Story = {
  args: { description: "kcal per day", target: null, data: [] },
};

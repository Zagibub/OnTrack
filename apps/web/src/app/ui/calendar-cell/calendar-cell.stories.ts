import type { Meta, StoryObj } from "@storybook/angular-vite";
import { CalendarCell } from "./calendar-cell";

const meta: Meta<CalendarCell> = {
  title: "UI/CalendarCell",
  component: CalendarCell,
  render: (args) => ({
    props: args,
    template: `<div style="width:3rem"><ot-calendar-cell
      [day]="day" [hasIntake]="hasIntake" [hasActivity]="hasActivity"
      [inMonth]="inMonth" [today]="today" /></div>`,
  }),
};
export default meta;

type Story = StoryObj<CalendarCell>;

export const Empty: Story = {
  args: { day: 12, hasIntake: false, hasActivity: false, inMonth: true, today: false },
};
export const IntakeOnly: Story = {
  args: { day: 12, hasIntake: true, hasActivity: false, inMonth: true, today: false },
};
export const IntakeAndActivity: Story = {
  args: { day: 12, hasIntake: true, hasActivity: true, inMonth: true, today: false },
};
export const Today: Story = {
  args: { day: 12, hasIntake: true, hasActivity: false, inMonth: true, today: true },
};
export const Adjacent: Story = {
  args: { day: 30, hasIntake: false, hasActivity: false, inMonth: false, today: false },
};

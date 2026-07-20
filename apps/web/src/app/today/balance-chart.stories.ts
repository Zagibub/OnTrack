import { importProvidersFrom } from "@angular/core";
import { computeDayBalance } from "@ontrack/shared";
import { applicationConfig, type Meta, type StoryObj } from "@storybook/angular-vite";
import { provideTranslocoTesting } from "../i18n/testing";
import { BalanceChart } from "./balance-chart";

// A realistic day: two meals, a morning workout, mid-afternoon "now".
const points = computeDayBalance({
  currentHour: 15,
  currentMinute: 20,
  tdee: 2400,
  intakeByHour: { 8: 450, 13: 700 },
  burnByHour: { 7: 280 },
}).points;

const meta: Meta<BalanceChart> = {
  title: "Today/Balance chart",
  component: BalanceChart,
  decorators: [applicationConfig({ providers: [importProvidersFrom(provideTranslocoTesting())] })],
  render: (args) => ({
    props: args,
    template: `<div style="max-width:360px"><ot-balance-chart [points]="points" [detailed]="detailed" /></div>`,
  }),
  args: { points, detailed: false },
};
export default meta;

type Story = StoryObj<BalanceChart>;

export const Focused: Story = { args: { detailed: false } };

export const Detailed: Story = { args: { detailed: true } };

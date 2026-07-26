import { importProvidersFrom } from "@angular/core";
import { computePeriodBalance } from "@ontrack/shared";
import { applicationConfig, type Meta, type StoryObj } from "@storybook/angular-vite";
import { provideTranslocoTesting } from "../i18n/testing";
import { PeriodChart, type PeriodChartPoint } from "./period-chart";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// A realistic week: some days eaten under, some over, "today" is Wednesday.
const balance = computePeriodBalance({
  days: WEEK.map((_, i) => ({ key: `2026-07-2${i}` })),
  tdee: 2400,
  todayKey: "2026-07-22",
  todayFraction: 0.6,
  intakeByDay: { "2026-07-20": 2600, "2026-07-21": 2100, "2026-07-22": 1400 },
});
const points: PeriodChartPoint[] = balance.points.map((p, i) => ({
  label: WEEK[i],
  balance: p.balance,
  projected: p.projected,
}));

const meta: Meta<PeriodChart> = {
  title: "Today/Period chart",
  component: PeriodChart,
  decorators: [applicationConfig({ providers: [importProvidersFrom(provideTranslocoTesting())] })],
  render: (args) => ({
    props: args,
    template: `<div style="max-width:360px"><ot-period-chart [points]="points" /></div>`,
  }),
  args: { points },
};
export default meta;

type Story = StoryObj<PeriodChart>;

export const Week: Story = {};

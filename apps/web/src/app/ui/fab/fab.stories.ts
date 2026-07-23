import type { Meta, StoryObj } from "@storybook/angular-vite";
import { Fab } from "./fab";

const meta: Meta<Fab> = {
  title: "UI/Fab",
  component: Fab,
  render: (args) => ({
    props: args,
    // Boxed so the fixed button stays inside the story frame.
    template: `<div style="position:relative;height:8rem">
      <ot-fab [link]="link" [from]="from" [label]="label" [testId]="testId" />
    </div>`,
  }),
};
export default meta;

type Story = StoryObj<Fab>;

export const Default: Story = {
  args: { link: "/add", from: "", label: "Add intake", testId: "fab" },
};

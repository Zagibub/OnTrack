import type { Meta, StoryObj } from "@storybook/angular-vite";
import { DumbbellIcon } from "lucide-angular";
import { FabBar } from "../fab-bar/fab-bar";
import { Fab } from "./fab";

const meta: Meta<Fab> = {
  title: "UI/Fab",
  component: Fab,
  render: (args) => ({
    props: args,
    // Boxed so the fixed bar stays inside the story frame.
    template: `<div style="position:relative;height:8rem">
      <ot-fab-bar>
        <ot-fab [link]="link" [from]="from" [label]="label" [testId]="testId"
                [tone]="tone" [icon]="icon" />
      </ot-fab-bar>
    </div>`,
    moduleMetadata: { imports: [FabBar] },
  }),
};
export default meta;

type Story = StoryObj<Fab>;

export const Default: Story = {
  args: { link: "/add", from: "", label: "Add intake", testId: "fab", tone: "primary" },
};

/** The amber activity action — the second half of the balance (011). */
export const Activity: Story = {
  args: {
    link: "/add/workout",
    label: "Add activity",
    testId: "add-activity",
    tone: "activity",
    icon: DumbbellIcon,
  },
};

/** Both actions as Today and History's day view show them, side by side. */
export const Pair: Story = {
  render: () => ({
    props: { dumbbell: DumbbellIcon },
    template: `<div style="position:relative;height:8rem">
      <ot-fab-bar>
        <ot-fab testId="add-intake" label="Add intake" />
        <ot-fab testId="add-activity" label="Add activity" link="/add/workout"
                tone="activity" [icon]="dumbbell" />
      </ot-fab-bar>
    </div>`,
    moduleMetadata: { imports: [Fab, FabBar] },
  }),
};

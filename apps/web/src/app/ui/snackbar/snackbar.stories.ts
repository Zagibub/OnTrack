import type { Meta, StoryObj } from "@storybook/angular-vite";
import { Snackbar } from "./snackbar";

const meta: Meta<Snackbar> = {
  title: "UI/Snackbar",
  component: Snackbar,
  render: (args) => ({
    props: args,
    template: `<ot-snackbar [message]="message" [actionLabel]="actionLabel" />`,
  }),
};
export default meta;

type Story = StoryObj<Snackbar>;

export const UndoDelete: Story = { args: { message: "Entry deleted", actionLabel: "Undo" } };
export const NoAction: Story = { args: { message: "Saved", actionLabel: "" } };

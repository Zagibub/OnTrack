import type { Meta, StoryObj } from "@storybook/angular-vite";
import { Card } from "./card";

const meta: Meta<Card> = {
  title: "UI/Card",
  component: Card,
  render: () => ({
    template: `
      <ot-card>
        <strong>Oatmeal with banana</strong>
        <p>320 kcal — breakfast</p>
      </ot-card>
    `,
    moduleMetadata: { imports: [Card] },
  }),
};
export default meta;

export const Default: StoryObj<Card> = {};

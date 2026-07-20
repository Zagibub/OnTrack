import { Component } from "@angular/core";
import { RouterLink } from "@angular/router";
import { TranslocoDirective } from "@jsverse/transloco";
import {
  CameraIcon,
  LucideAngularModule,
  type LucideIconData,
  MessageSquareIcon,
  PencilIcon,
  SearchIcon,
} from "lucide-angular";

interface Tile {
  key: string;
  labelKey: string;
  icon: LucideIconData;
  link: string;
}

const TILES: Tile[] = [
  { key: "manual", labelKey: "add.manual", icon: PencilIcon, link: "/add/manual" },
  { key: "search", labelKey: "add.search", icon: SearchIcon, link: "/add/search" },
  { key: "describe", labelKey: "add.describe", icon: MessageSquareIcon, link: "/add/describe" },
  { key: "photo", labelKey: "add.photo", icon: CameraIcon, link: "/add/photo" },
];

@Component({
  selector: "ot-add-chooser",
  imports: [RouterLink, LucideAngularModule, TranslocoDirective],
  template: `
    <main class="mx-auto max-w-md p-6" *transloco="let t">
      <header class="flex items-center gap-3">
        <a routerLink="/today" class="text-sm text-ink-muted underline">{{ t("common.back") }}</a>
        <h1 class="text-2xl font-bold">{{ t("add.title") }}</h1>
      </header>

      <div class="mt-6 grid grid-cols-2 gap-3">
        @for (tile of tiles; track tile.key) {
          <a
            [routerLink]="tile.link"
            [attr.data-testid]="'tile-' + tile.key"
            class="flex flex-col items-center gap-2 rounded-2xl bg-surface-muted p-6 text-center active:bg-surface"
          >
            <lucide-angular [img]="tile.icon" [size]="28" class="text-primary" />
            <span class="font-medium">{{ t(tile.labelKey) }}</span>
          </a>
        }
      </div>
    </main>
  `,
})
export class AddChooser {
  protected readonly tiles = TILES;
}

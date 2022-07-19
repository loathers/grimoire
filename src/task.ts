import { Familiar, Item, Location } from "kolmafia";
import { CombatStrategy } from "./combat";

export type Quest<T extends Task = Task> = {
  name: string;
  tasks: T[];
};

export type OutfitSlot =
  | "hat"
  | "back"
  | "weapon"
  | "offhand"
  | "shirt"
  | "pants"
  | "acc1"
  | "acc2"
  | "acc3"
  | "familiar";

export interface OutfitSpec {
  items?: Item[]; // Items to be equipped in any slot
  equip?: Partial<{ [slot in OutfitSlot]: Item | Item[] }>; // Items to be equipped in specific slots
  modifier?: string; // Modifier to maximize
  familiar?: Familiar; // Familiar to use
  avoid?: Item[]; // Items that cause issues and so should not be equipped
  skipDefaults?: boolean; // Do not equip default equipment; fully maximize
}

export type AcquireItem = {
  item: Item;
  num?: number;
  price?: number;
  useful?: () => boolean;
  optional?: boolean;
};

export type Task = {
  name: string;
  after: string[];

  ready?: () => boolean;
  completed: () => boolean;

  // How to perform the task
  // Executed as:
  //  1. prepare();
  //  2. adv1(do) OR do();
  //  3. post();
  prepare?: () => void;
  do: Location | (() => void);
  post?: () => void;

  acquire?: AcquireItem[];
  choices?: { [id: number]: number | (() => number) };
  limit?: Limit;
  outfit?: OutfitSpec | (() => OutfitSpec);
  combat?: CombatStrategy;
};

export type Limit = {
  tries?: number; // Number of attempts per script run, after which we abort.
  turns?: number; // Number of turns_spent in the task location, after which we abort.
  soft?: number; // Number of attempts per script run, after which we abort with "unlucky".
  message?: string;
};

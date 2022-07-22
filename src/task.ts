import { Familiar, Item, Location } from "kolmafia";
import { get } from "libram";
import { StringProperty } from "libram/dist/propertyTypes";
import { CombatStrategy } from "./combat";

export type Quest<T> = {
  name: string;
  completed?: () => boolean;
  tasks: T[];
};

export interface OutfitSpec {
  equip?: Item[]; // Items to be equipped in any slot
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
  get?: () => void;
};

export type Task<A extends string = never> = {
  name: string;
  after?: string[];

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
  combat?: CombatStrategy<A>;
};

export type Limit = {
  tries?: number; // Number of attempts per script run, after which we abort.
  turns?: number; // Number of turns_spent in the task location, after which we abort.
  soft?: number; // Number of attempts per script run, after which we abort with "unlucky".
  message?: string; // An extra message to include with the error.
};

/**
 * Returns the state of a quest as a numeric value as follows:
 *   "unstarted" => -1
 *   "started" => 0
 *   "stepNUM" => NUM
 *   "finished" => 999
 */
export function step(questName: StringProperty): number {
  const stringStep = get(questName);
  if (stringStep === "unstarted") return -1;
  else if (stringStep === "started") return 0;
  else if (stringStep === "finished") return 999;
  else {
    if (stringStep.substring(0, 4) !== "step") {
      throw "Quest state parsing error.";
    }
    return parseInt(stringStep.substring(4), 10);
  }
}

import { Effect, Familiar, Item, Location } from "kolmafia";
import { $item, get } from "libram";
import { StringProperty } from "libram/dist/propertyTypes";
import { CombatStrategy } from "./combat";

export type Quest<T> = {
  name: string;
  completed?: () => boolean;
  tasks: T[];
};

export type Modes = {
  backupcamera?: "ml" | "meat" | "init";
  umbrella?: "broken" | "forward" | "bucket" | "pitchfork" | "twirling" | "cocoon";
  snowsuit?: "eyebrows" | "smirk" | "nose" | "goatee" | "hat";
  edpiece?: "bear" | "owl" | "puma" | "hyena" | "mouse" | "weasel" | "fish";
  retrocape?:
    | ["vampire" | "heck" | "robot", "hold" | "thrill" | "kiss" | "kill"]
    | "vampire"
    | "heck"
    | "robot";
};

export const modeables = {
  backupcamera: $item`backup camera`,
  umbrella: $item`unbreakable umbrella`,
  snowsuit: $item`Snow Suit`,
  edpiece: $item`The Crown of Ed the Undying`,
  retrocape: $item`unwrapped knock-off retro superhero cape`,
} as const;

export const outfitSlots = [
  "hat",
  "back",
  "weapon",
  "offhand",
  "shirt",
  "pants",
  "acc1",
  "acc2",
  "acc3",
  "famequip",
] as const;

export type OutfitSlot = typeof outfitSlots[number];

export type OutfitEquips = Partial<{ [slot in OutfitSlot]: Item | Item[] }>;

export interface OutfitSpec extends OutfitEquips {
  equip?: Item[]; // Items to be equipped in any slot
  modes?: Modes; // Modes to set on particular items
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

  acquire?: AcquireItem[] | (() => AcquireItem[]);
  effects?: Effect[];
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

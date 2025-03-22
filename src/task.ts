import { Effect, Item, Location } from "kolmafia";
import { Delayed, get } from "libram";
import { StringProperty } from "libram/dist/propertyTypes";
import { CombatStrategy } from "./combat";
import { Limit } from "./limit";
import { Outfit, OutfitSpec } from "./outfit";

export type Quest<T, Context = void> = {
  name: string;
  completed?: (ctx: Context) => boolean;
  ready?: (ctx: Context) => boolean;
  tasks: T[];
};

export type AcquireItem<Context = void> = {
  item: Item;
  num?: number;
  price?: number;
  useful?: (ctx: Context) => boolean;
  optional?: boolean;
  get?: (ctx: Context) => void;
};

export type Task<A extends string = never, Context = void> = {
  name: string;
  after?: string[];

  ready?: (ctx: Context) => boolean;
  completed: (ctx: Context) => boolean;

  // How to perform the task
  // Executed as:
  //  1. prepare();
  //  2. adv1(do) OR do();
  //  3. post();
  prepare?: (ctx: Context) => void;
  do: Location | ((ctx: Context) => Location) | ((context: Context) => void);
  post?: (ctx: Context) => void;

  acquire?: Delayed<AcquireItem[], [Context]>;
  effects?: Delayed<Effect[], [Context]>;
  choices?: Delayed<{ [id: number]: number | string }, [Context]>;
  limit?: Limit<Context>;
  outfit?: Delayed<OutfitSpec | Outfit, [Context]>;
  combat?: CombatStrategy<A, Context>;
};

export type StrictCombatTask<
  A extends string = never,
  C extends CombatStrategy<A> = CombatStrategy<A>,
  O extends OutfitSpec | Outfit = OutfitSpec | Outfit,
  Context = void,
> = Omit<Task<A, Context>, "do" | "combat" | "outfit"> &
  (
    | {
        do: Delayed<Location> | ((context: Context) => void);
        combat: C;
        outfit: Delayed<O>;
      }
    | { do: () => void; outfit?: Delayed<O, [Context]> }
  );

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

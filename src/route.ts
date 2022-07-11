import { Quest, Task } from "./task";

export function getTasks<T extends Task = Task>(quests: Quest<T>[]): T[] {
  const result: T[] = [];
  for (const quest of quests) {
    for (const task of quest.tasks) {
      // Include quest name in task names and dependencies (unless dependency quest is given)
      task.name = `${quest.name}/${task.name}`;
      task.after = task.after.map((after) =>
        after.includes("/") ? after : `${quest.name}/${after}`
      );
      result.push(task);
    }
  }

  // Verify the dependency names of all tasks
  const names = new Set<string>();
  for (const task of result) names.add(task.name);
  for (const task of result) {
    for (const after of task.after) {
      if (!names.has(after)) {
        throw `Unknown task dependency ${after} of ${task.name}`;
      }
    }
  }
  return result;
}

export function orderByRoute<T extends Task = Task>(tasks: T[], routing: string[], ignore_missing_tasks?: boolean): Task[] {
  const priorities = new Map<string, [number, Task]>();
  for (const task of tasks) {
    priorities.set(task.name, [1000, task]);
  }

  // Prioritize the routing list of tasks first
  function setPriorityRecursive(task: string, priority: number) {
    const old_priority = priorities.get(task);
    if (old_priority === undefined) {
      if (ignore_missing_tasks) return;
      throw `Unknown routing task ${task}`;
    }
    if (old_priority[0] <= priority) return;
    priorities.set(task, [priority, old_priority[1]]);

    for (const requirement of old_priority[1].after) {
      setPriorityRecursive(requirement, priority - 0.01);
    }
  }
  for (let i = 0; i < routing.length; i++) {
    setPriorityRecursive(routing[i], i);
  }

  // Sort all tasks by priority.
  // Since this sort is stable, we default to earlier tasks.
  const result = tasks.slice();
  result.sort(
    (a, b) => (priorities.get(a.name) || [1000])[0] - (priorities.get(b.name) || [1000])[0]
  );
  return result;
}

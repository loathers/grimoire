import { Quest, Task } from "./task";

/**
 * Extract a list of tasks from the provided quests.
 *
 * Each task name is prepended with the quest name ("Quest Name/Task Name").
 * The quest-local names referred to in task.after are updated appropriately.
 * The task completion condition is updated to include the quest completion.
 *
 * Tasks are returned in-order: all tasks from the first quest, then all tasks
 * from the second quest, etc.
 *
 * @param quests The list of quests. This method does not modify the quest
 *    objects or their tasks.
 * @param implicitAfter If true, each task with task.after = undefined will
 *    have a dependency added on the previous task in the list.
 * @returns A list of tasks from the input quests (with updated properties).
 */
export function getTasks<A extends string, T extends Task<A> = Task<A>>(
  quests: Quest<T>[],
  implicitAfter = false,
  verifyTaskDependencies = true,
): T[] {
  const result: T[] = [];
  for (const quest of quests) {
    const questCompleted = quest.completed;
    const questReady = quest.ready;
    for (const task of quest.tasks) {
      // Include quest name in task names and dependencies (unless dependency quest is given)
      const renamedTask = { ...task };
      renamedTask.name = `${quest.name}/${task.name}`;
      renamedTask.after = task.after?.map((after) =>
        after.includes("/") ? after : `${quest.name}/${after}`,
      );
      // Include previous task as a dependency
      if (implicitAfter && task.after === undefined && result.length > 0)
        renamedTask.after = [result[result.length - 1].name];
      // Include quest completion in task completion
      if (questCompleted !== undefined) {
        const taskCompleted = task.completed;
        renamedTask.completed = () => questCompleted() || taskCompleted();
      }
      const taskReady = renamedTask.ready;
      if (questReady !== undefined && taskReady !== undefined) {
        renamedTask.ready = () => questReady() && taskReady();
      } else if (questReady !== undefined) {
        renamedTask.ready = () => questReady();
      }
      result.push(renamedTask);
    }
  }

  if (verifyTaskDependencies) verifyDependencies(result);
  return result;
}

export function verifyDependencies<A extends string>(tasks: Task<A>[]) {
  // Verify the dependency names of all tasks
  const names = new Set<string>();
  for (const task of tasks) names.add(task.name);
  for (const task of tasks) {
    for (const after of task.after ?? []) {
      if (!names.has(after)) {
        throw `Unknown task dependency ${after} of ${task.name}`;
      }
    }
  }
  return tasks;
}

export function orderByRoute<A extends string, T extends Task<A> = Task<A>>(
  tasks: T[],
  routing: string[],
  ignore_missing_tasks?: boolean,
): T[] {
  const priorities = new Map<string, [number, T]>();
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

    for (const requirement of old_priority[1].after ?? []) {
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
    (a, b) => (priorities.get(a.name) || [1000])[0] - (priorities.get(b.name) || [1000])[0],
  );
  return result;
}

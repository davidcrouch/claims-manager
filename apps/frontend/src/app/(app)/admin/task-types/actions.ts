'use server';

import { revalidatePath } from 'next/cache';
import { getServerApiClient } from '@/lib/server-api';
import type { TaskTypeMapping } from '@/types/api';

export async function listTaskTypeMappingsAction(): Promise<{
  mappings: TaskTypeMapping[];
  taskTypes: string[];
  error?: string;
}> {
  try {
    const api = await getServerApiClient();
    if (!api) return { mappings: [], taskTypes: [], error: 'Not authenticated' };
    const [mappings, taskTypes] = await Promise.all([
      api.getTaskTypeMappings({ includeInactive: true }),
      api.getCanonicalTaskTypes(),
    ]);
    return { mappings, taskTypes };
  } catch (err) {
    console.error('[admin/task-types/actions.listTaskTypeMappingsAction]', err);
    return {
      mappings: [],
      taskTypes: [],
      error: err instanceof Error ? err.message : 'Failed to load mappings',
    };
  }
}

export async function createTaskTypeMappingAction(input: {
  titlePattern: string;
  taskType: string;
  matchMode?: string;
  priority?: number;
  isActive?: boolean;
}): Promise<{ mapping?: TaskTypeMapping; error?: string }> {
  try {
    const api = await getServerApiClient();
    if (!api) return { error: 'Not authenticated' };
    const mapping = await api.createTaskTypeMapping(input);
    revalidatePath('/admin/task-types');
    return { mapping };
  } catch (err) {
    console.error('[admin/task-types/actions.createTaskTypeMappingAction]', err);
    return { error: err instanceof Error ? err.message : 'Failed to create mapping' };
  }
}

export async function updateTaskTypeMappingAction(
  id: string,
  input: {
    titlePattern?: string;
    taskType?: string;
    matchMode?: string;
    priority?: number;
    isActive?: boolean;
  },
): Promise<{ mapping?: TaskTypeMapping; error?: string }> {
  try {
    const api = await getServerApiClient();
    if (!api) return { error: 'Not authenticated' };
    const mapping = await api.updateTaskTypeMapping(id, input);
    revalidatePath('/admin/task-types');
    return { mapping };
  } catch (err) {
    console.error('[admin/task-types/actions.updateTaskTypeMappingAction]', err);
    return { error: err instanceof Error ? err.message : 'Failed to update mapping' };
  }
}

export async function deleteTaskTypeMappingAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const api = await getServerApiClient();
    if (!api) return { success: false, error: 'Not authenticated' };
    await api.deleteTaskTypeMapping(id);
    revalidatePath('/admin/task-types');
    return { success: true };
  } catch (err) {
    console.error('[admin/task-types/actions.deleteTaskTypeMappingAction]', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to delete mapping',
    };
  }
}

export async function backfillTaskTypesAction(): Promise<{
  updated?: number;
  scanned?: number;
  error?: string;
}> {
  try {
    const api = await getServerApiClient();
    if (!api) return { error: 'Not authenticated' };
    const result = await api.backfillTaskTypes();
    revalidatePath('/admin/task-types');
    revalidatePath('/tasks');
    return result;
  } catch (err) {
    console.error('[admin/task-types/actions.backfillTaskTypesAction]', err);
    return { error: err instanceof Error ? err.message : 'Failed to backfill' };
  }
}

import type { UploadTask, UploadStatus } from './types';

type UploadEventType = 'progress' | 'complete' | 'error' | 'queue-complete';

type UploadEventPayload = {
  progress: { taskId: string; progress: number };
  complete: { taskId: string; documentId: string };
  error: { taskId: string; error: string };
  'queue-complete': undefined;
};

type Listener<T extends UploadEventType> = (payload: UploadEventPayload[T]) => void;

const MAX_CONCURRENT = 3;

export class UploadEngine {
  private queue: UploadTask[] = [];
  private active = new Map<string, XMLHttpRequest>();
  private paused = false;
  private listeners = new Map<UploadEventType, Set<Listener<any>>>();

  on<T extends UploadEventType>(event: T, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => this.listeners.get(event)?.delete(listener);
  }

  private emit<T extends UploadEventType>(event: T, payload: UploadEventPayload[T]) {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  enqueue(tasks: UploadTask[]) {
    for (const task of tasks) {
      task.status = 'queued';
      task.progress = 0;
      this.queue.push(task);
    }
    this.processQueue();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.processQueue();
  }

  cancel(taskId: string) {
    const queueIdx = this.queue.findIndex((t) => t.id === taskId);
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
      return;
    }

    const xhr = this.active.get(taskId);
    if (xhr) {
      xhr.abort();
      this.active.delete(taskId);
      this.processQueue();
    }
  }

  getActiveTasks(): UploadTask[] {
    return [...this.queue];
  }

  private processQueue() {
    if (this.paused) return;

    while (this.active.size < MAX_CONCURRENT && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.startUpload(task);
    }
  }

  private startUpload(task: UploadTask) {
    task.status = 'uploading';

    const xhr = new XMLHttpRequest();
    this.active.set(task.id, xhr);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        task.progress = Math.round((e.loaded / e.total) * 100);
        this.emit('progress', { taskId: task.id, progress: task.progress });
      }
    });

    xhr.addEventListener('load', () => {
      this.active.delete(task.id);

      if (xhr.status >= 200 && xhr.status < 300) {
        task.status = 'completing';
        task.progress = 100;
        this.markComplete(task);
      } else {
        task.status = 'failed';
        task.error = `Upload failed with status ${xhr.status}`;
        this.emit('error', { taskId: task.id, error: task.error });
        this.checkQueueComplete();
        this.processQueue();
      }
    });

    xhr.addEventListener('error', () => {
      this.active.delete(task.id);
      task.status = 'failed';
      task.error = 'Network error during upload';
      this.emit('error', { taskId: task.id, error: task.error });
      this.checkQueueComplete();
      this.processQueue();
    });

    xhr.addEventListener('abort', () => {
      this.active.delete(task.id);
      task.status = 'failed';
      task.error = 'Upload cancelled';
    });

    xhr.open('PUT', task.uploadUrl);
    xhr.setRequestHeader('Content-Type', task.mimeType);
    xhr.send(task.file);
  }

  private async markComplete(task: UploadTask) {
    try {
      const res = await fetch('/api/documents/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: task.documentId }),
      });

      if (!res.ok) {
        throw new Error(`Complete request failed: ${res.status}`);
      }

      task.status = 'completed';
      this.emit('complete', { taskId: task.id, documentId: task.documentId });
    } catch (err) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : 'Failed to mark upload complete';
      this.emit('error', { taskId: task.id, error: task.error });
    } finally {
      this.checkQueueComplete();
      this.processQueue();
    }
  }

  private checkQueueComplete() {
    if (this.queue.length === 0 && this.active.size === 0) {
      this.emit('queue-complete', undefined);
    }
  }
}

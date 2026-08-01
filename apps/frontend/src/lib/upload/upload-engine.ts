import type { UploadTask } from './types';
import { generateThumbnailBlob } from './thumbnail-generator';

type UploadEventType = 'progress' | 'complete' | 'error' | 'queue-complete';

type UploadEventPayload = {
  progress: { taskId: string; progress: number };
  complete: { taskId: string; documentId: string };
  error: { taskId: string; error: string };
  'queue-complete': undefined;
};

type Listener<T extends UploadEventType> = (payload: UploadEventPayload[T]) => void;

const MAX_CONCURRENT = 3;
const LOG_PREFIX = 'UploadEngine';

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
        void this.finishUpload(task);
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

  private async finishUpload(task: UploadTask) {
    let thumbnailUploaded = false;

    if (task.thumbnailUploadUrl) {
      thumbnailUploaded = await this.uploadThumbnail(task);
    }

    await this.markComplete(task, thumbnailUploaded);
  }

  /** Best-effort thumbnail upload; failures do not fail the document upload. */
  private async uploadThumbnail(task: UploadTask): Promise<boolean> {
    if (!task.thumbnailUploadUrl) return false;

    try {
      const blob = await generateThumbnailBlob(task.file);
      if (!blob) return false;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Thumbnail upload status ${xhr.status}`));
        });
        xhr.addEventListener('error', () => reject(new Error('Thumbnail network error')));
        xhr.open('PUT', task.thumbnailUploadUrl!);
        xhr.setRequestHeader('Content-Type', 'image/png');
        xhr.send(blob);
      });

      console.debug(`[${LOG_PREFIX}.uploadThumbnail] docId=${task.documentId} ok`);
      return true;
    } catch (err) {
      console.warn(
        `[${LOG_PREFIX}.uploadThumbnail] docId=${task.documentId} failed:`,
        err instanceof Error ? err.message : err,
      );
      return false;
    }
  }

  private async markComplete(task: UploadTask, thumbnailUploaded: boolean) {
    try {
      const body: { documentId: string; thumbnailObjectPath?: string } = {
        documentId: task.documentId,
      };
      if (thumbnailUploaded && task.thumbnailObjectPath) {
        body.thumbnailObjectPath = task.thumbnailObjectPath;
      }

      const res = await fetch('/api/documents/upload-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

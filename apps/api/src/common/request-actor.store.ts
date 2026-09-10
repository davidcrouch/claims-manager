import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestActor {
  userId: string;
  userName: string;
}

const store = new AsyncLocalStorage<RequestActor | undefined>();

export function setRequestActor(actor: RequestActor | undefined): void {
  store.enterWith(actor);
}

export function getRequestActor(): RequestActor | undefined {
  return store.getStore();
}

export function runWithRequestActor<T>(
  actor: RequestActor | undefined,
  fn: () => T,
): T {
  return store.run(actor, fn);
}

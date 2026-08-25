import { CW_TASK_TYPES, extractCwTaskTypeName } from './cw-task-types';

describe('cw-task-types', () => {
  it('lists the official CW task types', () => {
    expect(CW_TASK_TYPES).toHaveLength(19);
    expect(CW_TASK_TYPES).toContain('Call to Schedule');
    expect(CW_TASK_TYPES).toContain('Send Scope/Contract');
  });

  it('extractCwTaskTypeName reads taskType.name from object', () => {
    expect(
      extractCwTaskTypeName({
        name: 'Call to Schedule #1',
        taskType: {
          id: '104253c5-e0cc-4401-9eae-68044b61eb2b',
          name: 'Call to Schedule',
          externalReference: 'Call to Schedule',
        },
      }),
    ).toBe('Call to Schedule');
  });

  it('extractCwTaskTypeName falls back to externalReference then string', () => {
    expect(
      extractCwTaskTypeName({
        taskType: { externalReference: 'Repair Update' },
      }),
    ).toBe('Repair Update');

    expect(extractCwTaskTypeName({ taskType: 'Submit Report' })).toBe('Submit Report');
  });

  it('extractCwTaskTypeName returns null when absent', () => {
    expect(extractCwTaskTypeName({ name: 'Some task' })).toBeNull();
    expect(extractCwTaskTypeName(null)).toBeNull();
  });
});

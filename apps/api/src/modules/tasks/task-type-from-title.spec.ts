import {
  normalizeTaskTitle,
  resolveTaskTypeFromTitle,
  defaultTaskTypeMappingSpecs,
} from './task-type-from-title';

describe('task-type-from-title', () => {
  const rules = defaultTaskTypeMappingSpecs();

  it('normalizeTaskTitle strips retry suffix and slash variants', () => {
    expect(normalizeTaskTitle('Call to Schedule #1')).toBe('call to schedule');
    expect(normalizeTaskTitle('Send Scope / Contract')).toBe('send scope contract');
    expect(normalizeTaskTitle('Signed Scope Contract')).toBe('signed scope contract');
    expect(normalizeTaskTitle('Signed Scope/Contract')).toBe('signed scope contract');
  });

  it('maps common inbound titles to canonical types', () => {
    expect(resolveTaskTypeFromTitle({ title: 'Call to Schedule #1', rules })).toBe(
      'Call to Schedule',
    );
    expect(resolveTaskTypeFromTitle({ title: 'Repair Update', rules })).toBe('Repair Update');
    expect(resolveTaskTypeFromTitle({ title: 'Send Scope/Contract', rules })).toBe(
      'Send Scope/Contract',
    );
    expect(resolveTaskTypeFromTitle({ title: 'Signed Scope Contract', rules })).toBe(
      'Signed Scope/Contract',
    );
    expect(resolveTaskTypeFromTitle({ title: 'Follow-up With Supplier', rules })).toBe(
      'Follow-up with Supplier',
    );
  });

  it('returns null for unknown titles', () => {
    expect(resolveTaskTypeFromTitle({ title: 'seed-task-01', rules })).toBeNull();
    expect(resolveTaskTypeFromTitle({ title: '', rules })).toBeNull();
  });

  it('respects priority and inactive flags', () => {
    const custom = [
      {
        titlePattern: 'Call',
        matchMode: 'prefix',
        taskType: 'Follow-up with Customer',
        priority: 10,
      },
      {
        titlePattern: 'Call to Schedule',
        matchMode: 'normalized',
        taskType: 'Call to Schedule',
        priority: 100,
      },
    ];
    expect(resolveTaskTypeFromTitle({ title: 'Call to Schedule #2', rules: custom })).toBe(
      'Follow-up with Customer',
    );

    const inactive = [
      {
        titlePattern: 'Repair Update',
        matchMode: 'normalized',
        taskType: 'Repair Update',
        isActive: false,
      },
    ];
    expect(resolveTaskTypeFromTitle({ title: 'Repair Update', rules: inactive })).toBeNull();
  });

  it('supports exact match mode', () => {
    const exact = [
      {
        titlePattern: 'Call to Schedule',
        matchMode: 'exact',
        taskType: 'Call to Schedule',
      },
    ];
    expect(resolveTaskTypeFromTitle({ title: 'Call to Schedule', rules: exact })).toBe(
      'Call to Schedule',
    );
    expect(resolveTaskTypeFromTitle({ title: 'Call to Schedule #1', rules: exact })).toBeNull();
  });
});

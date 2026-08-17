import {
  EMPTY_COPY,
  countActiveJobs,
  daysFromNow,
  humanizeTitle,
  isUuid,
  jobSubtitle,
  matchLookupIdsByNames,
  notificationHref,
  overdueCountFromBuckets,
  scheduleEventHref,
  statusFilterHref,
  utcDayBounds,
  shouldIncludeMyTasks,
  formatJobAddressLine,
  inactiveJobStatusIds,
} from './dashboard.utils';

describe('dashboard.utils', () => {
  describe('matchLookupIdsByNames', () => {
    it('matches lookup names case-insensitively', () => {
      const lookups = [
        { id: 'a', name: 'Received' },
        { id: 'b', name: 'issued' },
        { id: 'c', name: 'Accepted' },
      ];
      expect(matchLookupIdsByNames(lookups, ['Received', 'Issued'])).toEqual(['a', 'b']);
    });

    it('ignores blank names', () => {
      expect(
        matchLookupIdsByNames([{ id: 'a', name: null }, { id: 'b', name: '  ' }], ['Received']),
      ).toEqual([]);
    });
  });

  describe('countActiveJobs', () => {
    it('excludes archived closed cancelled and completed', () => {
      expect(
        countActiveJobs([
          { status: 'Pending', count: '4' },
          { status: 'In Progress', count: 3 },
          { status: 'Archived', count: '9' },
          { status: 'Completed', count: '2' },
          { status: 'Closed', count: '1' },
          { status: 'Cancelled', count: '1' },
          { status: 'Declined', count: '1' },
        ]),
      ).toBe(7);
    });
  });

  describe('humanizeTitle', () => {
    it('skips uuids and blanks', () => {
      expect(
        humanizeTitle(
          'Work order',
          '   ',
          '2f1b6c3e-8a44-4d1a-9c2e-0b1a2c3d4e5f',
          'WO-12',
        ),
      ).toBe('WO-12');
    });

    it('falls back when every candidate is unusable', () => {
      expect(humanizeTitle('Estimate', null, undefined, '')).toBe('Estimate');
    });
  });

  describe('isUuid', () => {
    it('detects uuids', () => {
      expect(isUuid('2f1b6c3e-8a44-4d1a-9c2e-0b1a2c3d4e5f')).toBe(true);
      expect(isUuid('WO-12')).toBe(false);
    });
  });

  describe('overdueCountFromBuckets', () => {
    it('sums non-current buckets', () => {
      expect(
        overdueCountFromBuckets([
          { label: 'Current', count: 5 },
          { label: '1-30 days', count: 2 },
          { label: '90+ days', count: 1 },
        ]),
      ).toBe(3);
    });
  });

  describe('statusFilterHref', () => {
    it('joins lookup ids', () => {
      expect(statusFilterHref('/work-orders', ['id-1', 'id-2'])).toBe(
        '/work-orders?status=id-1%2Cid-2',
      );
    });

    it('omits query when empty', () => {
      expect(statusFilterHref('/rfqs', [])).toBe('/rfqs');
    });
  });

  describe('notificationHref', () => {
    it('routes entities with detail pages', () => {
      expect(notificationHref('job', 'abc')).toBe('/jobs/abc');
      expect(notificationHref('work_order', 'wo1')).toBe('/work-orders/wo1');
    });

    it('routes list-only entities', () => {
      expect(notificationHref('task', 't1')).toBe('/tasks');
      expect(notificationHref('message', 'm1')).toBe('/messages');
    });
  });

  describe('scheduleEventHref', () => {
    it('maps event types to existing routes', () => {
      expect(scheduleEventHref('quote', 'q1')).toBe('/quotes/q1');
      expect(scheduleEventHref('appointment', 'a1')).toBe('/appointments?open=a1');
      expect(scheduleEventHref('task', 't1')).toBe('/tasks?open=t1');
    });
  });

  describe('jobSubtitle', () => {
    it('prefers external reference over name', () => {
      expect(jobSubtitle({ externalReference: 'MIL-1', name: 'Roof' })).toBe('MIL-1');
    });
  });

  describe('utcDayBounds', () => {
    it('returns a 24h utc window starting at midnight', () => {
      const bounds = utcDayBounds(new Date('2026-08-08T15:30:00.000Z'));
      expect(bounds.from).toBe('2026-08-08T00:00:00.000Z');
      expect(bounds.to).toBe('2026-08-09T00:00:00.000Z');
    });
  });

  describe('daysFromNow', () => {
    it('offsets utc date', () => {
      const d = daysFromNow(7, new Date('2026-08-08T00:00:00.000Z'));
      expect(d.toISOString().startsWith('2026-08-15')).toBe(true);
    });
  });

  describe('formatJobAddressLine', () => {
    it('joins suburb state postcode', () => {
      expect(
        formatJobAddressLine({
          addressSuburb: 'Richmond',
          addressState: 'VIC',
          addressPostcode: '3121',
        }),
      ).toBe('Richmond, VIC, 3121');
    });

    it('returns undefined when empty', () => {
      expect(formatJobAddressLine({})).toBeUndefined();
    });
  });

  describe('inactiveJobStatusIds', () => {
    it('returns archived and completed lookup ids', () => {
      expect(
        inactiveJobStatusIds([
          { id: '1', name: 'Pending' },
          { id: '2', name: 'Archived' },
          { id: '3', name: 'completed' },
        ]),
      ).toEqual(['2', '3']);
    });
  });

  describe('shouldIncludeMyTasks', () => {
    it('includes only when user id is present and assigned open tasks exist', () => {
      expect(shouldIncludeMyTasks('user-1', 2)).toBe(true);
      expect(shouldIncludeMyTasks('user-1', 0)).toBe(false);
      expect(shouldIncludeMyTasks(null, 3)).toBe(false);
      expect(shouldIncludeMyTasks('  ', 3)).toBe(false);
    });
  });

  describe('empty-state labelling', () => {
    it('does not claim personal overdue when empty', () => {
      expect(EMPTY_COPY.overdueTasks.toLowerCase()).not.toContain('you have');
      expect(EMPTY_COPY.money.toLowerCase()).not.toContain('you have 0');
      expect(EMPTY_COPY.unread).toBe("You're caught up.");
    });
  });
});

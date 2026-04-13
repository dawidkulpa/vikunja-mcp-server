import { describe, expect, it } from '@jest/globals';
import {
  applyFilter,
  evaluateArrayComparison,
  evaluateComparison,
  evaluateCondition,
  evaluateDateComparison,
  evaluateGroup,
  evaluateStringComparison,
  parseRelativeDate,
} from '../../../../src/tools/tasks/filtering/evaluators';
import type { FilterExpression, FilterGroup } from '../../../../src/types/filters';
import type { Task } from 'node-vikunja';

const baseTask: Task = {
  id: 1,
  title: 'Ship feature',
  description: 'Important release task',
  done: false,
  priority: 4,
  percent_done: 50,
  due_date: '2026-01-10T00:00:00.000Z',
  created: '2026-01-01T00:00:00.000Z',
  updated: '2026-01-05T00:00:00.000Z',
  assignees: [{ id: 2 } as any, { id: 3 } as any],
  labels: [{ id: 8 } as any],
} as Task;

describe('task filtering evaluators', () => {
  it('evaluates task fields across all supported condition types', () => {
    expect(evaluateCondition(baseTask, { field: 'done', operator: '=', value: false })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'priority', operator: '>=', value: 4 })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'percentDone', operator: '>', value: 20 })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'dueDate', operator: '=', value: '2026-01-10' })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'created', operator: '<', value: '2026-02-01' })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'updated', operator: '!=', value: '2026-01-06' })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'title', operator: 'like', value: 'feature' })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'description', operator: 'like', value: 'release' })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'assignees', operator: 'in', value: [3, 9] })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'labels', operator: 'not in', value: [1, 2] })).toBe(true);
    expect(evaluateCondition(baseTask, { field: 'title', operator: 'unknown', value: 'x' } as any)).toBe(false);
  });

  it('handles missing date and optional field values safely', () => {
    const task = { ...baseTask, due_date: undefined, created: undefined, updated: undefined, description: undefined, assignees: undefined, labels: undefined } as Task;
    expect(evaluateCondition(task, { field: 'dueDate', operator: '!=', value: '2026-01-10' })).toBe(true);
    expect(evaluateCondition(task, { field: 'dueDate', operator: '=', value: '2026-01-10' })).toBe(false);
    expect(evaluateCondition(task, { field: 'created', operator: '=', value: '2026-01-01' })).toBe(false);
    expect(evaluateCondition(task, { field: 'updated', operator: '=', value: '2026-01-05' })).toBe(false);
    expect(evaluateCondition(task, { field: 'description', operator: '=', value: '' })).toBe(true);
    expect(evaluateCondition(task, { field: 'assignees', operator: 'in', value: [1] })).toBe(false);
    expect(evaluateCondition(task, { field: 'labels', operator: 'not in', value: [1] })).toBe(true);
  });

  it('covers scalar comparison operators and invalid fallback', () => {
    expect(evaluateComparison(1, '=', 1)).toBe(true);
    expect(evaluateComparison(1, '!=', 2)).toBe(true);
    expect(evaluateComparison(3, '>', 2)).toBe(true);
    expect(evaluateComparison(3, '>=', 3)).toBe(true);
    expect(evaluateComparison(1, '<', 2)).toBe(true);
    expect(evaluateComparison(2, '<=', 2)).toBe(true);
    expect(evaluateComparison(1, '???', 1)).toBe(false);
  });

  it('covers date parsing and date comparison branches', () => {
    expect(parseRelativeDate('2026-02-03')?.toISOString()).toContain('2026-02-03');
    expect(parseRelativeDate('now')).toBeInstanceOf(Date);
    expect(parseRelativeDate('now+1s')).toBeInstanceOf(Date);
    expect(parseRelativeDate('now+1m')).toBeInstanceOf(Date);
    expect(parseRelativeDate('now+1h')).toBeInstanceOf(Date);
    expect(parseRelativeDate('now+1d')).toBeInstanceOf(Date);
    expect(parseRelativeDate('now+1w')).toBeInstanceOf(Date);
    expect(parseRelativeDate('now+1M')).toBeInstanceOf(Date);
    expect(parseRelativeDate('now+1y')).toBeInstanceOf(Date);
    expect(parseRelativeDate('never')).toBeNull();

    expect(evaluateDateComparison('2026-01-10T00:00:00.000Z', '=', '2026-01-10')).toBe(true);
    expect(evaluateDateComparison('2026-01-10T00:00:00.000Z', '!=', '2026-01-11')).toBe(true);
    expect(evaluateDateComparison('2026-01-10T00:00:00.000Z', '>', '2026-01-09')).toBe(true);
    expect(evaluateDateComparison('2026-01-10T00:00:00.000Z', '>=', '2026-01-10')).toBe(true);
    expect(evaluateDateComparison('2026-01-10T00:00:00.000Z', '<', '2026-01-11')).toBe(true);
    expect(evaluateDateComparison('2026-01-10T00:00:00.000Z', '<=', '2026-01-10')).toBe(true);
    expect(evaluateDateComparison('2026-01-10T00:00:00.000Z', '=', 'bad-date')).toBe(false);
    expect(evaluateDateComparison('2026-01-10T00:00:00.000Z', '??', '2026-01-10')).toBe(false);
  });

  it('covers string and array comparison helpers', () => {
    expect(evaluateStringComparison('Hello', '=', 'Hello')).toBe(true);
    expect(evaluateStringComparison('Hello', '!=', 'World')).toBe(true);
    expect(evaluateStringComparison('Hello World', 'like', 'world')).toBe(true);
    expect(evaluateStringComparison('Hello', '??', 'Hello')).toBe(false);

    expect(evaluateArrayComparison([1, 2], 'in', [2, 3])).toBe(true);
    expect(evaluateArrayComparison([1, 2], 'not in', [3, 4])).toBe(true);
    expect(evaluateArrayComparison([1, 2], '=', [1])).toBe(false);
  });

  it('applies group and expression operators correctly', () => {
    const andGroup: FilterGroup = {
      operator: '&&',
      conditions: [
        { field: 'done', operator: '=', value: false },
        { field: 'priority', operator: '>=', value: 4 },
      ],
    };
    const orGroup: FilterGroup = {
      operator: '||',
      conditions: [
        { field: 'done', operator: '=', value: true },
        { field: 'title', operator: 'like', value: 'ship' },
      ],
    };
    const expression: FilterExpression = {
      operator: '&&',
      groups: [andGroup, { operator: '&&', conditions: [{ field: 'title', operator: 'like', value: 'ship' }] }],
    };

    expect(evaluateGroup(baseTask, andGroup)).toBe(true);
    expect(evaluateGroup(baseTask, orGroup)).toBe(true);
    expect(applyFilter([baseTask, { ...baseTask, id: 2, title: 'Ignore', done: true, priority: 1 } as Task], expression)).toEqual([baseTask]);
  });
});

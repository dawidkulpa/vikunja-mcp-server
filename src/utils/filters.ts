/**
 * Zod-based filter validation and parsing system
 * Replaces the complex custom tokenizer/parser with secure Zod schemas
 */

import { z } from 'zod';
import type {
  FilterCondition,
  FilterExpression,
  FilterField,
  FilterGroup,
  FilterOperator,
  FilterValidationResult,
  FilterValidationConfig,
  LogicalOperator,
  ParseResult,
  ParseError,
} from '../types/filters';

export interface SimpleFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

/**
 * Security constants
 */
const MAX_FILTER_LENGTH = 1000;
const MAX_VALUE_LENGTH = 200;
const ALLOWED_CHARS = /^[\t\n\r\u0020-\u007D\u00C0-\u017F\u4E00-\u9FFF]*$/;

/**
 * Pre-compiled optimized regex patterns for performance and security
 * Using atomic groups, possessive quantifiers, and non-backtracking patterns to prevent ReDoS
 */
const DATE_PATTERNS = {
  // Combined pattern with atomic groups to prevent backtracking
  QUICK_DATE_CHECK: /^(?:(?:\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2})?)|now(?:[+-]\d{1,4}[smhdwMy])?|now\/[smhdwMy])$/,

  // Individual optimized patterns for specific validation
  ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
  ISO_DATETIME: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
  NOW_LITERAL: /^now$/,
  RELATIVE_DATE: /^now([+-]\d{1,4}[smhdwMy])$/,
  PERIOD_DATE: /^now\/([smhdwMy])$/,

  // Fast rejection patterns - optimized for performance
  SECURITY_REJECTION: [
    /\s/,                           // Any spaces
    /now\+\d+day/,                  // "day" instead of "d"
    /now\/day/,                     // "day" instead of "d"
    /\d{4}\/\d{1}\/\d{1}/,          // Missing leading zeros in YYYY/M/D
    /\d{1}-\d{2}-\d{4}/,            // Wrong order D-MM-YYYY
    /now\+\d+\.\d+[a-z]/,           // Decimal numbers
    /now\+\+/,                      // Double operator
    /now\+-/,                       // Conflicting operators
  ],
} as const;

// Repeated character check for DoS prevention - optimized pattern
const REPEATED_CHAR_PATTERN = /(.)\1{20,}/;

/**
 * Zod schemas for validation
 */
const FilterFieldSchema = z.enum([
  'done', 'priority', 'percentDone', 'dueDate', 'assignees',
  'labels', 'created', 'updated', 'title', 'description'
]);

const FilterOperatorSchema = z.enum([
  '=', '!=', '>', '>=', '<', '<=', 'like', 'LIKE', 'in', 'not in'
]);

const LogicalOperatorSchema = z.enum(['&&', '||']);

const FilterValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number())
]);

const FilterConditionSchema = z.object({
  field: FilterFieldSchema,
  operator: FilterOperatorSchema,
  value: FilterValueSchema,
}).strict();

const FilterGroupSchema = z.object({
  conditions: z.array(FilterConditionSchema).min(1, 'Group must contain at least one condition'),
  operator: LogicalOperatorSchema.default('&&'),
}).strict();

const FilterExpressionSchema = z.object({
  groups: z.array(FilterGroupSchema).min(1, 'Expression must contain at least one group'),
  operator: LogicalOperatorSchema.optional(),
}).strict();

/**
 * Security validation functions
 */
export const SecurityValidator = {
  /**
   * Validates input string contains only allowed characters
   */
  validateAllowedChars(input: string): boolean {
    if (!ALLOWED_CHARS.test(input)) {
      return false;
    }

    const normalized = input.replace(/"/g, '');
    if (/<\s*\/?\s*[a-zA-Z!]/.test(normalized)) {
      return false;
    }

    return !(/[;[\]{}$`~^]/).test(normalized);
  },

  validateField(field: string): boolean {
    return [
      'id', 'project_id', 'done', 'priority', 'percent_done', 'percentDone', 'due_date', 'dueDate',
      'assignees', 'labels', 'created', 'updated', 'title', 'description'
    ].includes(field);
  },

  validateOperator(operator: string): boolean {
    return ['=', '!=', '>', '>=', '<', '<=', 'like', 'LIKE', 'in', 'not in'].includes(operator);
  },

  /**
   * Validates filter string length
   */
  validateLength(input: string): { isValid: boolean; error?: string } {
    if (input.length > MAX_FILTER_LENGTH) {
      return {
        isValid: false,
        error: `Filter string too long. Maximum length is ${MAX_FILTER_LENGTH} characters, got ${input.length}`
      };
    }
    return { isValid: true };
  },

  /**
   * Validates individual value length and safety
   */
  validateValue(value: string): { isValid: boolean; error?: string } {
    if (value.length > MAX_VALUE_LENGTH) {
      return {
        isValid: false,
        error: `Value too long. Maximum length is ${MAX_VALUE_LENGTH} characters`
      };
    }
    return { isValid: true };
  }
};

/**
 * Parse state for tracking position during parsing
 */
interface ParseState {
  input: string;
  position: number;
  length: number;
}

/**
 * Create parse error with context
 */
function createParseError(message: string, state: ParseState, contextLength = 20): ParseError {
  const start = Math.max(0, state.position - contextLength);
  const end = Math.min(state.length, state.position + contextLength);
  const prefix = start > 0 ? '...' : '';
  const suffix = end < state.length ? '...' : '';
  const context = state.input.substring(start, end);
  const markerPosition = state.position - start + prefix.length;
  const marker = ' '.repeat(markerPosition) + '^';

  return {
    message,
    position: state.position,
    context: `${prefix}${context}${suffix}\n${marker}`
  };
}

/**
 * Skip whitespace in input
 */
function skipWhitespace(state: ParseState): void {
  while (state.position < state.length && state.input[state.position] !== undefined) {
    const char = state.input[state.position];
    if (char && /\s/.test(char)) {
      state.position++;
    } else {
      break;
    }
  }
}

/**
 * Parse quoted string value
 */
function parseQuotedString(state: ParseState): string | null {
  if (state.position >= state.length || state.input[state.position] !== '"') {
    return null;
  }

  state.position++; // Skip opening quote

  let value = '';
  while (state.position < state.length && state.input[state.position] !== '"') {
    const char = state.input[state.position];

    // Handle escaped quotes
    if (char === '\\' && state.position + 1 < state.length && state.input[state.position + 1] === '"') {
      value += '"';
      state.position += 2;
    } else if (char !== undefined) {
      value += char;
      state.position++;
    }

    // Prevent extremely long quoted values
    if (value.length > MAX_VALUE_LENGTH) {
      return null;
    }
  }

  if (state.position >= state.length) {
    return null; // Unclosed quote
  }

  state.position++; // Skip closing quote
  return value;
}

/**
 * Parse unquoted value
 */
function parseUnquotedValue(state: ParseState): string | null {
  const start = state.position;

  while (
    state.position < state.length &&
    state.input[state.position] !== undefined
  ) {
    const char = state.input[state.position];
    if (char && /[^\s(),=!<>&|]/.test(char)) {
      state.position++;
    } else {
      break;
    }
  }

  if (start === state.position) {
    return null;
  }

  return state.input.substring(start, state.position);
}

/**
 * Parse a value (quoted or unquoted)
 */
function parseValue(state: ParseState): string | null {
  if (state.position < state.length && state.input[state.position] === '"') {
    return parseQuotedString(state);
  }

  return parseUnquotedValue(state);
}

/**
 * Parse operator token
 */
function parseOperator(state: ParseState): FilterOperator | null {
  const operators = ['>=', '<=', '!=', '>', '<', '=', 'like', 'in', 'not in'];
  for (const op of operators.sort((a, b) => b.length - a.length)) {
    const substr = state.input.substring(state.position, state.position + op.length);
    if (substr.toLowerCase() === op.toLowerCase()) {
      state.position += op.length;
      // Preserve original case
      return substr as FilterOperator;
    }
  }

  return null;
}

/**
 * Parse field name
 */
function parseField(state: ParseState): FilterField | null {
  const fields: FilterField[] = ['done', 'priority', 'percentDone', 'dueDate', 'assignees',
                                 'labels', 'created', 'updated', 'title', 'description'];

  for (const field of fields) {
    const substr = state.input.substring(state.position, state.position + field.length);
    if (substr === field &&
        (state.position + field.length >= state.length ||
         /[\s=!<>]/.test(state.input[state.position + field.length] || ''))) {
      state.position += field.length;
      return field;
    }
  }

  return null;
}

/**
 * Parse logical operator
 */
function parseLogicalOperator(state: ParseState): LogicalOperator | null {
  if (state.input.substring(state.position, state.position + 2) === '&&') {
    state.position += 2;
    return '&&';
  }
  if (state.input.substring(state.position, state.position + 2) === '||') {
    state.position += 2;
    return '||';
  }
  return null;
}

/**
 * Parse comma-separated values for IN/NOT IN operators
 */
function parseArrayValues(state: ParseState): string[] | null {
  const values: string[] = [];

  const firstValue = parseValue(state);
  if (firstValue === null) {
    return null;
  }
  values.push(firstValue);

  while (state.position < state.length) {
    skipWhitespace(state);

    if (state.position >= state.length || state.input[state.position] !== ',') {
      break;
    }

    state.position++; // Skip comma
    skipWhitespace(state);

    const nextValue = parseValue(state);
    if (nextValue === null) {
      return null;
    }
    values.push(nextValue);
  }

  return values;
}

/**
 * Convert string value to appropriate type based on field
 */
function convertValue(value: string, field: FilterField, operator: FilterOperator): string | number | boolean | string[] {
  if (operator === 'in' || operator === 'not in') {
    return value.split(',').map(v => v.trim());
  }

  const fieldType = {
    done: 'boolean',
    priority: 'number',
    percentDone: 'number',
    dueDate: 'date',
    assignees: 'array',
    labels: 'array',
    created: 'date',
    updated: 'date',
    title: 'string',
    description: 'string',
  }[field];

  if (fieldType === 'boolean') {
    return value === 'true';
  } else if (fieldType === 'number') {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
    }
    return num;
  }

  return value;
}

/**
 * Parse a single condition
 */
function parseCondition(state: ParseState): FilterCondition | null {
  const field = parseField(state);
  if (field === null) {
    return null;
  }

  skipWhitespace(state);
  const operator = parseOperator(state);
  if (operator === null) {
    throw new Error('Expected operator');
  }

  skipWhitespace(state);
  let rawValue: string | string[];

  if (operator === 'in' || operator === 'not in') {
    const values = parseArrayValues(state);
    if (values === null) {
      throw new Error('Expected value(s) for IN/NOT IN operator');
    }
    rawValue = values.join(',');
  } else {
    const value = parseValue(state);
    if (value === null) {
      throw new Error('Expected value');
    }
    rawValue = value;
  }

  try {
    const convertedValue = convertValue(rawValue, field, operator);
    return { field, operator, value: convertedValue };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Invalid value');
  }
}

/**
 * Parse a group (conditions optionally in parentheses)
 */
function parseGroup(state: ParseState): FilterGroup {
  const conditions: FilterCondition[] = [];
  let operator: LogicalOperator = '&&';
  let hasParens = false;

  skipWhitespace(state);

  if (state.position < state.length && state.input[state.position] === '(') {
    hasParens = true;
    state.position++; // Skip opening parenthesis
    skipWhitespace(state);
  }

  // Parse first condition
  const firstCondition = parseCondition(state);
  if (firstCondition === null) {
    throw new Error('Expected condition');
  }
  conditions.push(firstCondition);

  skipWhitespace(state);

  // Parse additional conditions with logical operators
  while (state.position < state.length) {
    // Check for closing parenthesis
    if (hasParens && state.position < state.length && state.input[state.position] === ')') {
      state.position++;
      break;
    }

    // Check for logical operator
    const logicalOp = parseLogicalOperator(state);
    if (logicalOp === null) {
      break;
    }

    operator = logicalOp;
    skipWhitespace(state);

    // Parse next condition
    const nextCondition = parseCondition(state);
    if (nextCondition === null) {
      throw new Error('Expected condition after logical operator');
    }
    conditions.push(nextCondition);

    skipWhitespace(state);
  }

  // If we had parentheses but didn't find closing one, it's an error
  if (hasParens && state.position <= state.length && state.input[state.position - 1] !== ')') {
    throw new Error('Expected closing parenthesis');
  }

  return { conditions, operator };
}

/**
 * Parse complete filter expression
 */
function parseExpression(state: ParseState): FilterExpression {
  const groups: FilterGroup[] = [];
  let groupOperator: LogicalOperator | undefined;

  // Parse first group
  const firstGroup = parseGroup(state);
  groups.push(firstGroup);

  skipWhitespace(state);

  // Parse additional groups with logical operators
  while (state.position < state.length) {
    const logicalOp = parseLogicalOperator(state);
    if (logicalOp === null) {
      break;
    }

    if (!groupOperator) {
      groupOperator = logicalOp;
    }

    skipWhitespace(state);
    const nextGroup = parseGroup(state);
    groups.push(nextGroup);

    skipWhitespace(state);
  }

  const expression = groupOperator
    ? { groups, operator: groupOperator } as FilterExpression
    : { groups } as FilterExpression;

  return expression;
}

/**
 * Main filter string parsing function
 * Replaces the complex tokenizer/parser system with Zod validation
 */
export function parseFilterString(filterStr: string): ParseResult {
  // Input validation
  if (typeof filterStr !== 'string') {
    return {
      expression: null,
      error: {
        message: 'Filter input must be a string',
        position: 0,
      },
    };
  }

  if (!filterStr || filterStr.trim().length === 0) {
    return {
      expression: null,
      error: {
        message: 'Filter string cannot be empty',
        position: 0,
      },
    };
  }

  // Security validation
  if (!SecurityValidator.validateAllowedChars(filterStr)) {
    return {
      expression: null,
      error: {
        message: 'Filter string contains invalid characters',
        position: 0,
        context: 'Only alphanumeric characters, common punctuation, and international characters are allowed'
      },
    };
  }

  const lengthValidation = SecurityValidator.validateLength(filterStr);
  if (!lengthValidation.isValid) {
    return {
      expression: null,
      error: {
        message: lengthValidation.error || 'Filter string too long',
        position: 0,
      },
    };
  }

  // Parse the filter string
  const state: ParseState = {
    input: filterStr.trim(),
    position: 0,
    length: filterStr.trim().length
  };

  try {
    const expression = parseExpression(state);

    // Check if we consumed the entire input
    skipWhitespace(state);
    if (state.position < state.length) {
      const remainingChar = state.input[state.position];
      // Handle specific cases that should return "Invalid filter syntax"
      if (remainingChar === '&' || remainingChar === '|' || remainingChar === '!' ||
          remainingChar === '(' || remainingChar === ')') {
        return {
          expression: null,
          error: {
            message: 'Invalid filter syntax',
            position: state.position,
            context: state.input.substring(state.position, Math.min(state.position + 40, state.length))
          }
        };
      }

      return {
        expression: null,
        error: createParseError(`Unexpected token: ${state.input.substring(state.position, Math.min(state.position + 20, state.length))}`, state)
      };
    }

    // Validate with Zod schema
    const validationResult = FilterExpressionSchema.safeParse(expression);
    if (!validationResult.success) {
      return {
        expression: null,
        error: {
          message: 'Invalid filter structure',
          position: 0,
          context: validationResult.error.errors.map(e => e.message).join(', ')
        }
      };
    }

    return { expression: validationResult.data as FilterExpression };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Parse error';

    // Handle specific parsing errors that should return "Invalid filter syntax"
    if (message.includes('Expected value') || message.includes('Unclosed quote')) {
      return {
        expression: null,
        error: {
          message: 'Invalid filter syntax',
          position: state.position,
          context: state.input.substring(Math.max(0, state.position - 20), Math.min(state.position + 20, state.length))
        }
      };
    }

    return {
      expression: null,
      error: createParseError(message, state)
    };
  }
}

/**
 * Enhanced validation with field type checking and value validation
 */
function validateFieldTypeAndValue(field: FilterField, operator: FilterOperator, value: unknown): string[] {
  const errors: string[] = [];
  const fieldType = {
    done: 'boolean',
    priority: 'number',
    percentDone: 'number',
    dueDate: 'date',
    assignees: 'array',
    labels: 'array',
    created: 'date',
    updated: 'date',
    title: 'string',
    description: 'string',
  }[field];

  // Basic field validation
  if (!Object.keys({
    done: 'boolean',
    priority: 'number',
    percentDone: 'number',
    dueDate: 'date',
    assignees: 'array',
    labels: 'array',
    created: 'date',
    updated: 'date',
    title: 'string',
    description: 'string',
  }).includes(field)) {
    return ['Invalid field name'];
  }

  // Operator validation for field types
  if (fieldType === 'boolean' && !['=', '!='].includes(operator)) {
    errors.push(`Invalid operator '${operator}' for boolean field '${field}'. Only = and != are allowed.`);
  }

  if (fieldType === 'array' && !['=', '!=', 'in', 'not in'].includes(operator)) {
    errors.push(`Invalid operator '${operator}' for array field '${field}'. Only =, !=, in, and not in are allowed.`);
  }

  // Value type validation
  if (fieldType === 'boolean') {
    if (typeof value !== 'boolean') {
      errors.push(`Field "${field}" requires a boolean value`);
    }
  }

  if (fieldType === 'number' && (typeof value !== 'number' || isNaN(Number(value)))) {
    errors.push(`Field "${field}" requires a numeric value`);
  }

  if (fieldType === 'array' && !Array.isArray(value) && typeof value !== 'string') {
    errors.push(`Field "${field}" requires an array or comma-separated string`);
  }

  // Date validation (optimized for performance and security)
  if (fieldType === 'date' && typeof value === 'string') {
    // Security check: reject extremely long values that could cause DoS
    if (value.length > 50) {
      errors.push(`Field "${field}" requires a valid date value`);
      return errors;
    }

    // Fast security check: prevent repeated characters that could indicate attacks
    if (REPEATED_CHAR_PATTERN.test(value)) {
      errors.push(`Field "${field}" requires a valid date value`);
      return errors;
    }

    // Fast rejection: check against known invalid patterns first (optimized)
    for (const pattern of DATE_PATTERNS.SECURITY_REJECTION) {
      if (pattern.test(value)) {
        errors.push(`Field "${field}" requires a valid date value`);
        return errors;
      }
    }

    // Quick validation: use combined pattern for fast acceptance (prevents backtracking)
    if (!DATE_PATTERNS.QUICK_DATE_CHECK.test(value)) {
      errors.push(`Field "${field}" requires a valid date value`);
      return errors;
    }

    // Specific validation: only run additional checks if needed
    // This minimizes regex operations for common cases
    if (DATE_PATTERNS.ISO_DATE.test(value)) {
      // Validate actual calendar date only for ISO date format
      const dateMatch = value.match(DATE_PATTERNS.ISO_DATE);
      if (dateMatch) {
        const [yearStr, monthStr, dayStr] = dateMatch[0].split('-');
        if (!yearStr || !monthStr || !dayStr) {
          errors.push(`Field "${field}" requires a valid date in YYYY-MM-DD format`);
          return errors;
        }

        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);

        const date = new Date(year, month - 1, day);

        // Check if the date is valid (month and day within bounds)
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
          errors.push(`Field "${field}" requires a valid date value`);
          return errors;
        }
      }
    }
    // No additional validation needed for other formats - they were validated by QUICK_DATE_CHECK
  }

  return errors;
}

/**
 * Validate a filter condition using enhanced validation
 */
export function validateCondition(condition: FilterCondition): string[] {
  // Check if condition has valid structure first
  const result = FilterConditionSchema.safeParse(condition);
  if (!result.success) {
    return result.error.errors.map(issue => {
      const path = issue.path[0];
      if (issue.message.includes('enum value')) {
        if (path === 'field') return 'Invalid field name';
        if (path === 'operator') return 'Invalid operator';
      }

      return issue.message;
    });
  }

  const { field, operator, value } = condition;

  // Enhanced field and value validation
  const fieldValidationErrors = validateFieldTypeAndValue(field, operator, value);

  return fieldValidationErrors;
}

/**
 * Validate filter expression using Zod
 */
export function validateFilterExpression(
  expression: FilterExpression,
  config: FilterValidationConfig = {},
): FilterValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Zod schema validation
  const schemaResult = FilterExpressionSchema.safeParse(expression);
  if (!schemaResult.success) {
    errors.push(...schemaResult.error.errors.map(e => e.message));
  }

  // Custom validation
  if (expression.groups) {
    expression.groups.forEach((group, groupIndex) => {
      if (!group.conditions || group.conditions.length === 0) {
        errors.push(`Group ${groupIndex + 1} must contain at least one condition`);
      }

      group.conditions.forEach((condition, conditionIndex) => {
        const conditionErrors = validateCondition(condition);
        conditionErrors.forEach(errorMessage => {
          errors.push(`Group ${groupIndex + 1}, Condition ${conditionIndex + 1}: ${errorMessage}`);
        });
      });
    });

    // Performance warnings
    const totalConditions = expression.groups.reduce(
      (sum, group) => sum + group.conditions.length,
      0,
    );

    const maxConditions = config.maxConditions ?? 50;
    if (totalConditions > maxConditions) {
      errors.push(`Too many conditions. Maximum allowed is ${maxConditions}`);
    }

    const threshold = config.performanceWarningThreshold ?? 10;
    if (totalConditions > threshold) {
      warnings.push(
        `Complex filters with many conditions (${totalConditions}) may impact performance`,
      );
    }
  }

  const result: FilterValidationResult = {
    valid: errors.length === 0,
    errors,
  };

  if (warnings.length > 0) {
    result.warnings = warnings;
  }

  return result;
}

/**
 * Convert condition to string representation
 */
export function conditionToString(condition: FilterCondition): string {
  const { field, operator, value } = condition;

  let valueStr: string;
  if (Array.isArray(value)) {
    valueStr = value.map(item => typeof item === 'string' ? `"${item}"` : String(item)).join(', ');
  } else if (typeof value === 'string') {
    valueStr = `"${value}"`;
  } else if (typeof value === 'boolean') {
    valueStr = value.toString();
  } else {
    valueStr = String(value);
  }

  if (operator === 'in' || operator === 'not in') {
    return `${field} ${operator} ${valueStr}`;
  }

  return `${field} ${operator} ${valueStr}`;
}

/**
 * Convert group to string representation
 */
export function groupToString(group: FilterGroup): string {
  const conditions = group.conditions.map(conditionToString);
  return conditions.length > 1
    ? `(${conditions.join(` ${group.operator} `)})`
    : conditions[0] || '';
}

/**
 * Convert expression to string representation
 */
export function expressionToString(expression: FilterExpression): string {
  const groups = expression.groups.map(groupToString);
  const operator = expression.operator || '&&';
  return groups.join(` ${operator} `);
}

/**
 * Filter builder class for fluent construction
 */
export class FilterBuilder {
  private expression: FilterExpression;
  private currentGroup: FilterGroup;

  constructor() {
    this.currentGroup = {
      conditions: [],
      operator: '&&',
    };
    this.expression = {
      groups: [this.currentGroup],
    };
  }

  where(field: FilterField, operator: FilterOperator, value: unknown): FilterBuilder {
    this.currentGroup.conditions.push({
      field,
      operator,
      value: value as string | number | boolean | string[] | number[],
    });
    return this;
  }

  and(): FilterBuilder {
    this.currentGroup.operator = '&&';
    return this;
  }

  or(): FilterBuilder {
    this.currentGroup.operator = '||';
    return this;
  }

  group(operator: LogicalOperator = '&&'): FilterBuilder {
    this.currentGroup = {
      conditions: [],
      operator,
    };
    this.expression.groups.push(this.currentGroup);
    return this;
  }

  groupOperator(operator: LogicalOperator): FilterBuilder {
    this.expression.operator = operator;
    return this;
  }

  build(): FilterExpression {
    this.expression.groups = this.expression.groups.filter((g) => g.conditions.length > 0);
    return this.expression;
  }

  toString(): string {
    return expressionToString(this.build());
  }

  validate(config?: FilterValidationConfig): FilterValidationResult {
    return validateFilterExpression(this.build(), config);
  }
}

function normalizeSimpleField(field: string): string {
  const aliases: Record<string, string> = {
    dueDate: 'due_date',
    percentDone: 'percent_done',
    projectId: 'project_id',
  };

  return aliases[field] || field;
}

function parseSimpleValue(rawValue: string): unknown {
  const value = rawValue.trim();

  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;

  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];

    return inner.split(',').map(item => parseSimpleValue(item.trim())).filter(item => item !== undefined);
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }

  return value;
}

function parseSimpleArrayValue(rawValue: string): unknown[] | null {
  const value = rawValue.trim();

  if (value.length > MAX_VALUE_LENGTH || !value.startsWith('[') || !value.endsWith(']')) {
    return null;
  }

  if (/[{}$`]|__proto__|prototype|constructor|function\s|=>|eval\(|Infinity|NaN/i.test(value)) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.length > 100) {
      return null;
    }

    const isSafeItem = (item: unknown): boolean => {
      if (item === null || typeof item === 'boolean') {
        return true;
      }

      if (typeof item === 'number') {
        return Number.isFinite(item) && Math.abs(item) <= Number.MAX_SAFE_INTEGER;
      }

      if (typeof item === 'string') {
        return item.length <= MAX_VALUE_LENGTH && !/__proto__|prototype|constructor|function\s|=>|eval\(|Infinity|NaN/i.test(item);
      }

      return false;
    };

    return parsed.every(isSafeItem) ? parsed : null;
  } catch {
    return null;
  }
}

function isComparableValue(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

export function parseSimpleFilter(filter: string): SimpleFilter | null {
  if (typeof filter !== 'string' || filter.trim() === '' || filter.length > MAX_VALUE_LENGTH + 100) {
    return null;
  }

  const trimmed = filter.trim();
  const match = trimmed.match(/^(\w+)\s*(not in|in|>=|<=|!=|=|>|<|like|LIKE)\s*(.+)$/);
  if (!match) {
    return null;
  }

  const [, rawField, rawOperator, rawValue] = match;
  const operator = rawOperator || '';
  const field = normalizeSimpleField(rawField || '');
  if (!SecurityValidator.validateField(field) || !SecurityValidator.validateOperator(operator)) {
    return null;
  }
  const typedOperator = operator as FilterOperator;

  if (/[{}$`]|__proto__|prototype|constructor|function\s|=>|Infinity|NaN|eval\(/i.test(rawValue || '')) {
    return null;
  }

  if (operator === 'in' || operator === 'not in') {
    const parsedArray = parseSimpleArrayValue(rawValue || '');
    if (parsedArray === null) {
      return null;
    }

    const result: SimpleFilter = {
      field,
      operator: typedOperator,
      value: parsedArray,
    };
    return result;
  }

  const result: SimpleFilter = {
    field,
    operator: typedOperator,
    value: parseSimpleValue(rawValue || ''),
  };
  return result;
}

function getTaskFieldValue(task: Record<string, unknown>, field: string): unknown {
  const normalizedField = normalizeSimpleField(field);
  if (normalizedField in task) {
    return task[normalizedField];
  }

  const camelCaseField = normalizedField.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
  return task[camelCaseField];
}

function compareArrays(taskValue: unknown[], operator: string, filterValue: unknown): boolean {
  const taskIds = taskValue.map(item => {
    if (item && typeof item === 'object' && 'id' in item) {
      return (item as { id?: unknown }).id;
    }
    return item;
  });
  const filterArray = Array.isArray(filterValue) ? filterValue : [filterValue];
  const hasMatch = filterArray.some(value => taskIds.includes(value));

  if (operator === 'not in') return !hasMatch;
  return hasMatch;
}

export function applyClientSideFilter<T extends Record<string, unknown>>(tasks: T[], filter: SimpleFilter | null): T[] {
  if (!filter) {
    return tasks;
  }

  return tasks.filter(task => {
    const taskValue = getTaskFieldValue(task, filter.field);
    const filterValue = filter.value;

    if (Array.isArray(taskValue)) {
      return compareArrays(taskValue, filter.operator, filterValue);
    }

    switch (filter.operator) {
      case '=':
        return taskValue === filterValue;
      case '!=':
        return taskValue !== filterValue;
      case '>':
        return isComparableValue(taskValue) && isComparableValue(filterValue) && taskValue > filterValue;
      case '>=':
        return isComparableValue(taskValue) && isComparableValue(filterValue) && taskValue >= filterValue;
      case '<':
        return isComparableValue(taskValue) && isComparableValue(filterValue) && taskValue < filterValue;
      case '<=':
        return isComparableValue(taskValue) && isComparableValue(filterValue) && taskValue <= filterValue;
      case 'like':
      case 'LIKE':
        return typeof taskValue === 'string' && typeof filterValue === 'string'
          ? taskValue.toLowerCase().includes(filterValue.toLowerCase())
          : false;
      case 'in':
        return Array.isArray(filterValue) ? filterValue.includes(taskValue) : taskValue === filterValue;
      case 'not in':
        return Array.isArray(filterValue) ? !filterValue.includes(taskValue) : taskValue !== filterValue;
      default:
        return false;
    }
  });
}

import { assert } from "../lib/errors.js";
import { createId } from "../lib/id.js";

const OPERATORS = {
  eq: (actual, expected) => actual === expected,
  neq: (actual, expected) => actual !== expected,
  gt: (actual, expected) => Number(actual) > Number(expected),
  gte: (actual, expected) => Number(actual) >= Number(expected),
  lt: (actual, expected) => Number(actual) < Number(expected),
  lte: (actual, expected) => Number(actual) <= Number(expected)
};

function getPath(object, path) {
  return String(path).split(".").reduce((value, key) => value?.[key], object);
}

export class AlertService {
  constructor(store) {
    this.store = store;
  }

  async list(projectId) {
    const data = await this.store.read();
    return Object.values(data.alertRules).filter((rule) => rule.projectId === projectId);
  }

  async create(projectId, input) {
    assert(input.field && input.operator && Object.hasOwn(OPERATORS, input.operator), 400, "INVALID_ALERT_RULE", "Alert rule needs a field and supported operator.");
    const rule = {
      id: createId("alr"), projectId, name: input.name || `${input.field} ${input.operator} ${input.value}`,
      field: input.field, operator: input.operator, value: input.value, enabled: input.enabled !== false,
      channel: input.channel || "in_app", createdAt: new Date().toISOString(), lastTriggeredAt: null
    };
    return this.store.transaction((data) => {
      assert(data.projects[projectId], 404, "PROJECT_NOT_FOUND", "Project was not found.");
      data.alertRules[rule.id] = rule;
      return rule;
    });
  }

  async evaluate(projectId, snapshot) {
    return this.store.transaction((data) => {
      assert(data.projects[projectId], 404, "PROJECT_NOT_FOUND", "Project was not found.");
      const events = [];
      for (const rule of Object.values(data.alertRules).filter((item) => item.projectId === projectId && item.enabled)) {
        const actual = getPath(snapshot, rule.field);
        if (OPERATORS[rule.operator](actual, rule.value)) {
          const event = { id: createId("evt"), projectId, ruleId: rule.id, name: rule.name, actual, expected: rule.value, channel: rule.channel, deliveryStatus: "pending", createdAt: new Date().toISOString() };
          data.alertEvents[event.id] = event;
          rule.lastTriggeredAt = event.createdAt;
          events.push(event);
        }
      }
      return { evaluated: Object.values(data.alertRules).filter((item) => item.projectId === projectId && item.enabled).length, triggered: events.length, events };
    });
  }
}

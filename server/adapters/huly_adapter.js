'use strict';

const { v4: uuidv4 } = require('uuid');

const CLASSES = {
  Issue: 'tracker:class:Issue',
  IssueStatus: 'tracker:class:IssueStatus',
  Project: 'tracker:class:Project',
  PersonAccount: 'contact:class:PersonAccount',
  Person: 'contact:class:Person',
  TxCreateDoc: 'core:class:TxCreateDoc',
  TxUpdateDoc: 'core:class:TxUpdateDoc',
  TxRemoveDoc: 'core:class:TxRemoveDoc',
  TxSpace: 'core:space:Tx',
};

const STATUS_CATEGORIES = {
  Backlog: 'tracker:status:Backlog',
  Todo: 'tracker:status:Todo',
  InProgress: 'tracker:status:InProgress',
  Done: 'tracker:status:Done',
  Cancelled: 'tracker:status:Cancelled',
};

const PRIORITY_LABELS = {
  0: 'None',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

function generateId() {
  return uuidv4();
}

function buildFindAllMessage(id, className, filter = {}, options = {}) {
  return {
    id,
    method: 'findAll',
    params: [className, filter, options],
  };
}

function buildTxMessage(id, txDoc) {
  return {
    id,
    method: 'tx',
    params: [txDoc],
  };
}

function buildCreateIssueTx(memberId, projectId, attrs) {
  const objectId = generateId();
  const txId = generateId();
  return {
    _class: CLASSES.TxCreateDoc,
    space: CLASSES.TxSpace,
    modifiedBy: memberId,
    modifiedOn: Date.now(),
    objectId,
    objectClass: CLASSES.Issue,
    objectSpace: projectId,
    attributes: {
      title: attrs.title,
      status: attrs.status || STATUS_CATEGORIES.Todo,
      priority: attrs.priority != null ? attrs.priority : 0,
      number: attrs.number,
      rank: attrs.rank || '0|hzzzzz:',
      kind: 'tracker:taskType:Issue',
      identifier: attrs.identifier,
      assignee: attrs.assignee || null,
      dueDate: attrs.dueDate || null,
      estimation: attrs.estimation || 0,
    },
    _id: txId,
  };
}

function buildUpdateIssueTx(memberId, issueId, projectId, operations) {
  return {
    _class: CLASSES.TxUpdateDoc,
    space: CLASSES.TxSpace,
    modifiedBy: memberId,
    modifiedOn: Date.now(),
    objectId: issueId,
    objectClass: CLASSES.Issue,
    objectSpace: projectId,
    operations,
    _id: generateId(),
  };
}

function buildRemoveIssueTx(memberId, issueId, projectId) {
  return {
    _class: CLASSES.TxRemoveDoc,
    space: CLASSES.TxSpace,
    modifiedBy: memberId,
    modifiedOn: Date.now(),
    objectId: issueId,
    objectClass: CLASSES.Issue,
    objectSpace: projectId,
    _id: generateId(),
  };
}

function parseQueryResult(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (raw.dataType === 'TotalArray' && Array.isArray(raw.value)) return raw.value;
  return [];
}

function parsePersonName(hulyName) {
  if (!hulyName) return '';
  const parts = hulyName.split(',');
  if (parts.length === 1) return parts[0].trim();
  const last = parts[0].trim();
  const first = parts[1].trim();
  return first ? `${first} ${last}` : last;
}

function parseIssuesToPortalFormat(hulyIssues, memberMap = {}) {
  return hulyIssues.map((issue) => ({
    id: issue._id,
    title: issue.title,
    identifier: issue.identifier,
    status: issue.status,
    statusCategory: issue.status,
    priority: issue.priority != null ? issue.priority : 0,
    priorityLabel: PRIORITY_LABELS[issue.priority] || 'None',
    assigneeId: issue.assignee || null,
    assigneeName: issue.assignee ? (memberMap[issue.assignee] || null) : null,
    dueDate: issue.dueDate ? new Date(issue.dueDate).toISOString() : null,
    projectId: issue.space,
    number: issue.number,
  }));
}

function parseProjectsToPortalFormat(hulyProjects) {
  return hulyProjects.map((project) => ({
    id: project._id,
    name: project.name,
    identifier: project.identifier,
    memberCount: Array.isArray(project.members) ? project.members.length : 0,
  }));
}

module.exports = {
  CLASSES,
  STATUS_CATEGORIES,
  PRIORITY_LABELS,
  generateId,
  buildFindAllMessage,
  buildTxMessage,
  buildCreateIssueTx,
  buildUpdateIssueTx,
  buildRemoveIssueTx,
  parseQueryResult,
  parsePersonName,
  parseIssuesToPortalFormat,
  parseProjectsToPortalFormat,
};

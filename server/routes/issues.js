'use strict';

const { Router } = require('express');
const {
  CLASSES,
  parseIssuesToPortalFormat,
  parsePersonName,
  buildCreateIssueTx,
  buildUpdateIssueTx,
  buildRemoveIssueTx,
} = require('../adapters/huly_adapter');

const ALLOWED_UPDATE_FIELDS = ['title', 'status', 'priority', 'assignee', 'dueDate'];

function issuesRouter() {
  const router = Router();

  router.get('/project/:projectId', async (req, res, next) => {
    try {
      const { hulyConnection } = req.session;
      const { projectId } = req.params;

      const [issues, accounts, persons] = await Promise.all([
        hulyConnection.findAll(CLASSES.Issue, { space: projectId }),
        hulyConnection.findAll(CLASSES.PersonAccount, {}),
        hulyConnection.findAll(CLASSES.Person, {}),
      ]);

      // Build member name map: accountId -> displayName
      const personMap = {};
      for (const p of persons) {
        personMap[p._id] = parsePersonName(p.name);
      }

      const memberMap = {};
      for (const a of accounts) {
        memberMap[a._id] = a.person ? (personMap[a.person] || a.email) : a.email;
      }

      res.json({ ok: true, data: parseIssuesToPortalFormat(issues, memberMap) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const { hulyConnection, memberId } = req.session;
      const { title, projectId, status, priority, assignee, dueDate } = req.body;

      if (!title || !projectId) {
        return res.status(400).json({ ok: false, error: 'title and projectId are required' });
      }

      // Get the project to build identifier
      const [projects, existingIssues] = await Promise.all([
        hulyConnection.findAll(CLASSES.Project, { _id: projectId }),
        hulyConnection.findAll(CLASSES.Issue, { space: projectId }),
      ]);

      const project = projects[0];
      if (!project) {
        return res.status(404).json({ ok: false, error: 'Project not found' });
      }

      const maxNumber = existingIssues.reduce((max, i) => (i.number > max ? i.number : max), 0);
      const nextNumber = maxNumber + 1;
      const identifier = `${project.identifier}-${nextNumber}`;

      const txDoc = buildCreateIssueTx(memberId, projectId, {
        title,
        status,
        priority,
        assignee,
        dueDate: dueDate ? new Date(dueDate).getTime() : null,
        number: nextNumber,
        identifier,
      });

      await hulyConnection.tx(txDoc);

      // Return full issue object so the frontend can place it on the board
      const statusVal = txDoc.attributes.status;
      const priorityVal = txDoc.attributes.priority;

      res.status(201).json({
        ok: true,
        data: {
          id: txDoc.objectId,
          identifier,
          title,
          status: statusVal,
          statusCategory: statusVal,
          priority: priorityVal,
          priorityLabel: require('../adapters/huly_adapter').PRIORITY_LABELS[priorityVal] || 'None',
          assigneeId: txDoc.attributes.assignee || null,
          assigneeName: null,
          dueDate: txDoc.attributes.dueDate || null,
          projectId,
          number: nextNumber,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const { hulyConnection, memberId } = req.session;
      const { id } = req.params;

      const operations = {};
      for (const field of ALLOWED_UPDATE_FIELDS) {
        if (field in req.body) {
          // Convert date strings to timestamps for Huly
          if (field === 'dueDate' && req.body[field]) {
            operations[field] = new Date(req.body[field]).getTime();
          } else {
            operations[field] = req.body[field];
          }
        }
      }

      if (Object.keys(operations).length === 0) {
        return res.status(400).json({ ok: false, error: 'No valid fields to update' });
      }

      // Look up the issue to get its projectId (objectSpace)
      const issues = await hulyConnection.findAll(CLASSES.Issue, { _id: id });
      const issue = issues[0];
      if (!issue) {
        return res.status(404).json({ ok: false, error: 'Issue not found' });
      }

      const txDoc = buildUpdateIssueTx(memberId, id, issue.space, operations);
      await hulyConnection.tx(txDoc);

      res.json({ ok: true, data: { id, ...operations } });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const { hulyConnection, memberId } = req.session;
      const { id } = req.params;

      const issues = await hulyConnection.findAll(CLASSES.Issue, { _id: id });
      const issue = issues[0];
      if (!issue) {
        return res.status(404).json({ ok: false, error: 'Issue not found' });
      }

      const txDoc = buildRemoveIssueTx(memberId, id, issue.space);
      await hulyConnection.tx(txDoc);

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = issuesRouter;

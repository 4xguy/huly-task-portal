'use strict';

const { Router } = require('express');
const { CLASSES, parsePersonName } = require('../adapters/huly_adapter');

function metaRouter() {
  const router = Router();

  router.get('/members', async (req, res, next) => {
    try {
      const { hulyConnection } = req.session;

      const [accounts, persons] = await Promise.all([
        hulyConnection.findAll(CLASSES.PersonAccount, {}),
        hulyConnection.findAll(CLASSES.Person, {}),
      ]);

      const personMap = {};
      for (const p of persons) {
        personMap[p._id] = parsePersonName(p.name);
      }

      const members = accounts.map((a) => ({
        id: a._id,
        email: a.email,
        name: a.person ? (personMap[a.person] || a.email) : a.email,
        personId: a.person || null,
      }));

      res.json({ ok: true, data: members });
    } catch (err) {
      next(err);
    }
  });

  router.get('/statuses', async (req, res, next) => {
    try {
      const { hulyConnection } = req.session;
      const statuses = await hulyConnection.findAll(CLASSES.IssueStatus, {});

      const parsed = statuses.map((s) => ({
        id: s._id,
        name: s.name,
        category: s.category,
      }));

      res.json({ ok: true, data: parsed });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = metaRouter;

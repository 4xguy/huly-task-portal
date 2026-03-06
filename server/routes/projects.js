'use strict';

const { Router } = require('express');
const { CLASSES, parseProjectsToPortalFormat } = require('../adapters/huly_adapter');

function projectsRouter() {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const { hulyConnection, memberId } = req.session;
      const raw = await hulyConnection.findAll(CLASSES.Project, {});

      // Filter to projects where the member is listed
      const accessible = raw.filter((p) => {
        const members = Array.isArray(p.members) ? p.members : [];
        const owners = Array.isArray(p.owners) ? p.owners : [];
        return members.includes(memberId) || owners.includes(memberId);
      });

      res.json({ ok: true, data: parseProjectsToPortalFormat(accessible) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = projectsRouter;

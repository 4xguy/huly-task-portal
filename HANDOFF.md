# Huly Task Portal - Session Handoff

## What This Is
Lightweight kanban task portal (`~/ai/huly-task-portal`) that proxies to Huly self-hosted v0.6.468 at `adm.icvida.com`. Live at **https://tasks.icvida.com**.

## Architecture
```
Browser → Express proxy (REST) → Huly (WebSocket JSON-RPC)
```
- **Server**: Express + `ws` library, CommonJS, no build step
- **Frontend**: Vanilla JS SPA with Pico CSS + SortableJS via CDN
- **Version firewall**: `server/adapters/huly_adapter.js` — ONLY file with Huly protocol knowledge

## Deployment
- **Dokploy**: Project `kEAcyCEcRQY5tmQRtvqHT`, App `5H3MtkFBbcWS8Plnf8OtF`
- **Domain**: `tasks.icvida.com` (Let's Encrypt SSL)
- **Repo**: github.com/4xguy/huly-task-portal (public, master branch)
- **Deploy**: Push to master, then:
  ```
  curl -s "https://dokploy.icvida.com/api/application.deploy" \
    -H "x-api-key: my_appnSKiibXzcyfYtdLpcLtNowaRgyQrIiTuRYEmYBddlzXXOYTfxhaiLHmZXRbtQjeQ" \
    -H "Content-Type: application/json" \
    -d '{"applicationId":"5H3MtkFBbcWS8Plnf8OtF"}'
  ```
- **Env vars**: HULY_URL=https://adm.icvida.com, HULY_WORKSPACE=vida, PORT=3000, SESSION_SECRET=<set>, SESSION_TTL_MINUTES=30, NODE_ENV=production

## Huly API Protocol
- **Auth**: POST `/_accounts` with `{"method":"login","params":["email","password"]}` → `{result:{token}}`
- **Workspace**: POST `/_accounts` with `{"method":"selectWorkspace","params":[token,"vida"]}` → `{result:{endpoint, token}}`
- **WebSocket**: Connect to `${endpoint}/${workspaceToken}` (token in URL path)
- **Query**: `{"id":"uuid","method":"findAll","params":["className",filter,opts]}`
- **Mutate**: `{"id":"uuid","method":"tx","params":[txDoc]}` where txDoc has `_class: "core:class:TxCreateDoc"` etc.
- **Classes**: tracker:class:Issue, tracker:class:Project, tracker:class:IssueStatus, contact:class:PersonAccount, contact:class:Person
- **Status categories from Huly**: `task:statusCategory:UnStarted` (Backlog), `task:statusCategory:ToDo`, `task:statusCategory:Active` (InProgress), `task:statusCategory:Won` (Done), `task:statusCategory:Lost` (Cancelled)

## Key Files
| File | Purpose |
|------|---------|
| `server/adapters/huly_adapter.js` | ALL Huly protocol knowledge (class names, tx builders, parsers) |
| `server/services/huly_connection.js` | WebSocket client with auto-reconnect, 15s ping, message correlation |
| `server/services/huly_auth.js` | HTTP login + selectWorkspace |
| `server/services/session_manager.js` | In-memory session store with 30min TTL |
| `server/routes/issues.js` | Issue CRUD (GET, POST, PATCH, DELETE) |
| `server/routes/auth.js` | Login/logout/me with signed httpOnly cookie |
| `server/index.js` | Express app entry point |
| `public/js/views/board.js` | Kanban board + list view (~520 lines, largest file) |
| `public/js/components/issue_modal.js` | Create/edit issue modal |
| `public/css/app.css` | All styles including responsive/mobile |

## Test Credentials
- **Email**: keithrivas@gmail.com
- **Password**: 5hyfroot

---

## PRIORITY BUG: Issue Creation Malformed

### Symptom
Issues created via the portal show up in the portal's list view and in Huly's "All Issues" view, but NOT in Huly's project issue view. They are malformed.

### Root Cause (DIAGNOSED)
The `buildCreateIssueTx` in `server/adapters/huly_adapter.js` (line 53) is missing several required fields. Comparison of a Huly-created issue vs a portal-created issue:

**Portal sends:**
```json
{
  "kind": "tracker:taskType:Issue",
  "attachedTo": (missing),
  "attachedToClass": (missing),
  "collection": (missing),
  "description": (missing),
  "comments": (missing),
  "subIssues": (missing),
  "parents": (missing),
  "relations": (missing),
  "childInfo": (missing),
  "labels": (missing),
  "reports": (missing),
  "reportedTime": (missing),
  "remainingTime": (missing)
}
```

**Huly expects:**
```json
{
  "kind": "tracker:taskTypes:Issue",       // NOTE: plural "taskTypes" not "taskType"
  "attachedTo": "tracker:ids:NoParent",
  "attachedToClass": "tracker:class:Issue",
  "collection": "subIssues",
  "description": "",
  "comments": 0,
  "subIssues": 0,
  "parents": [],
  "relations": [],
  "childInfo": [],
  "labels": 0,
  "reports": 0,
  "reportedTime": 0,
  "remainingTime": 0
}
```

### Fix Location
`server/adapters/huly_adapter.js`, function `buildCreateIssueTx` (line 53-78). Update the `attributes` object to include all required fields with correct values. The `kind` typo is the most critical — `tracker:taskTypes:Issue` (plural).

### Verification
After fixing, create an issue via the portal, then check in Huly's project issue view (not "All Issues"). It should appear there.

### Existing Bad Issues to Clean Up
Issues API-14 through API-17 in the "API Demo" project were created with the wrong format. They can be deleted via the portal or Huly UI.

---

## Other Known Issues
- Portal list view shows created issues (because findAll returns them with space filter) but kanban board may not show them if status category mapping fails
- No sub-issue support
- Mobile tab view untested
- Status category mapping relies on extracting last segment after `:` from Huly refs

## Commits
1. `bceea0e` - Initial implementation (24 files)
2. `f9cad99` - Include package-lock.json for Docker build
3. `1105c12` - WebSocket stability: auto-reconnect, keepalive ping
4. `aa726a4` - Add list view with sortable columns
5. `bdd904b` - Refetch issues from server after create/update/delete

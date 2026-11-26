import { Router } from 'express';

import { HttpError } from '../lib/http-error.js';
import { currentUserId } from '../middleware/require-auth.js';
import { findUserWithToken } from '../models/user.js';
import { githubClient } from '../services/github.js';

export const githubRouter = Router();

const MAX_REPO_PAGES = 5; // 500 repos is plenty for a picker

/**
 * Repos the user can attach a Zap to. Creating a webhook needs admin rights
 * on the repo, so we only offer those (and skip archived repos).
 */
githubRouter.get('/repos', async (req, res) => {
  const user = await findUserWithToken(currentUserId(req));
  if (!user) {
    throw new HttpError(401, 'Sign in required');
  }

  const octokit = githubClient(user.accessToken);
  let pages = 0;
  const repos = await octokit.paginate(
    octokit.rest.repos.listForAuthenticatedUser,
    { per_page: 100, sort: 'pushed', affiliation: 'owner,collaborator,organization_member' },
    (response, done) => {
      if (++pages >= MAX_REPO_PAGES) done();
      return response.data;
    },
  );

  res.json(
    repos
      .filter((repo) => repo.permissions?.admin && !repo.archived)
      .map((repo) => ({
        fullName: repo.full_name,
        private: repo.private,
        url: repo.html_url,
        pushedAt: repo.pushed_at,
      })),
  );
});

```bash
(cd apps/web && yarn dev) & (cd apps/mobile && EAS_NO_VCS=1 EAS_PROJECT_ROOT=. EXPO_NO_METRO_LAZY=1 EXPO_UNSTABLE_TREE_SHAKING=1 EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1 yarn dlx expo start --offline --web)
```

# Managing e2b

All of this requires the e2b cli to be installed.

## Publish bundling checks

CI runs the V2 OpenNext publish bundle check only when files that affect V2
web publishing are touched, including:

- `packages/e2b-templates/v2/apps/web/**`
- `packages/e2b-templates/v2/publisher/**`
- `packages/e2b-templates/v2/package.json`
- `packages/e2b-templates/v2/yarn.lock`
- `packages/e2b-templates/tests/v2/**`
- `packages/published-apps/**`
- `apps/flux/core/src/services/nextjs-deployment/**`

Run the same check locally with:

```bash
yarn workspace @createinc/e2b-templates test:v2:publish-bundle
```

That builds the V2 Docker image if needed, writes the same
`open-next.config.ts` used by the publish flow, installs the user app from its
own workspace manifest, links publisher-owned OpenNext tooling from
`/opt/anything-publisher`, and runs the publisher OpenNext binary. It catches
build-time bundling failures such as unresolved Node builtins or missing
publish-time dependencies before a PR merges.

The web template intentionally declares `@opentelemetry/api` even though app
source does not import it directly. Next's server build may resolve it as an
optional peer while bundling auth/runtime packages for OpenNext publish, so keep
it installed unless that publish bundle check proves it is no longer needed.

For runtime-import smoke coverage, run:

```bash
RUN_OPENNEXT_RUNTIME_SMOKE=1 yarn workspace @createinc/e2b-templates test:v2:publish-bundle
```

The smoke variant imports the built OpenNext server entry after the bundle is
created. It is intentionally manual/offline because it is slower and more
sensitive to OpenNext output shape, but it is the thing to run when changing
`serverExternalPackages`, auth/database dependencies, or OpenNext runtime
packaging.

## How to develop on your own template
### Create your template
1. Make sure you have auth configured to the devleopment team
2. NOTE: you will have to stop this command soon after running it. This is the only way I know how to create a template...
3. Run:
```bash
e2b template build
```
and after about a second, just cancel it This will create an e2b.toml file in the current directory.The only important part of this config is the template_id.

1. Now, move this file to e2b.local.toml. This will ensure it is not committed
1. Finally, copy the other relevant fileds from the e2b.development.beta.toml file to your e2b.local.toml file.
1. Set your template_name to something that is specific to you e.g. "create-development-marcus"
1. Go into launchdarkly (https://app.launchdarkly.com/projects/flux/flags/e2b-monorepo-template/targeting?env=production&env=development&selected-env=development)
1. Add your template name as a variation, and configure it to be served in whatever environments you want in the development environment.

NOTE: if you want to test it in production, you will have to create your own template (with a different id) in the production team as well.

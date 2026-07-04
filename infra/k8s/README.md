# Kubernetes Manifests

Apply order (or use a GitOps tool like Flux/ArgoCD to manage this automatically):

```bash
# 1. Namespace & RBAC
kubectl apply -f namespace.yaml

# 2. Secrets (fill in your real values first!)
kubectl apply -f secrets.yaml

# 3. Infrastructure dependencies
kubectl apply -f postgres/
kubectl apply -f redis/

# 4. Run DB migration job (re-apply whenever migrations change)
kubectl apply -f jobs/migrate.yaml
kubectl wait --for=condition=complete job/db-migrate -n turnbased --timeout=120s

# 5. Application
kubectl apply -f server/
kubectl apply -f client/

# 6. Ingress
kubectl apply -f ingress.yaml
```

## Image tags

The `docker-build-push` workflow pushes images to:
- `ghcr.io/<org>/turnbased-server:<sha-short>`
- `ghcr.io/<org>/turnbased-client:<sha-short>`

Update the `image:` field in `server/deployment.yaml` and `client/deployment.yaml`
after each build, or wire up a GitOps controller to watch the registry.

## Secrets

Never commit real secret values. Edit `secrets.yaml` locally (it is git-ignored
by the rule added alongside these manifests), fill in the base64 values, then
`kubectl apply` it once — or use Sealed Secrets / External Secrets Operator.

Generate base64 values:
```bash
echo -n 'your-value' | base64
```

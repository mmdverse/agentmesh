# Kubernetes manifests - Phase 5

This folder will contain K8s manifests for AgentMesh.

- Namespace
- ConfigMaps
- Secrets
- Postgres, Redis, NATS, MinIO (or external)
- Gateway Deployment (stateless, HPA)
- Control Plane Deployment
- Workers
- Services, Ingress

For Phase 0, use Docker Compose: `pnpm docker:up`

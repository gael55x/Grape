CREATE TABLE IF NOT EXISTS symbol_nodes (
  symbol_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES repos(repo_id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(source_id) ON DELETE CASCADE,
  path TEXT NOT NULL,
  language TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol_kind TEXT NOT NULL CHECK (symbol_kind IN ('function', 'class', 'method', 'interface', 'type', 'variable', 'constant', 'module', 'route', 'unknown')),
  start_line INTEGER NOT NULL CHECK (start_line >= 1),
  end_line INTEGER NOT NULL CHECK (end_line >= start_line),
  body_hash TEXT,
  signature_hash TEXT,
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symbol_edges (
  edge_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES repos(repo_id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES repo_snapshots(snapshot_id) ON DELETE CASCADE,
  from_symbol_id TEXT NOT NULL REFERENCES symbol_nodes(symbol_id) ON DELETE CASCADE,
  to_symbol_id TEXT REFERENCES symbol_nodes(symbol_id) ON DELETE SET NULL,
  to_ref TEXT,
  edge_type TEXT NOT NULL CHECK (edge_type IN ('contains', 'imports', 'exports', 'calls', 'references', 'routes_to', 'configures')),
  confidence TEXT NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  discovery_method TEXT NOT NULL CHECK (discovery_method IN ('ast', 'import_resolution', 'framework_extractor', 'config_scan', 'runtime_trace', 'manual', 'inferred')),
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (to_symbol_id IS NOT NULL OR to_ref IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_symbol_nodes_snapshot_path ON symbol_nodes(snapshot_id, path);
CREATE INDEX IF NOT EXISTS idx_symbol_nodes_snapshot_kind ON symbol_nodes(snapshot_id, symbol_kind);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_snapshot_type ON symbol_edges(snapshot_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_from ON symbol_edges(from_symbol_id);
CREATE INDEX IF NOT EXISTS idx_symbol_edges_to ON symbol_edges(to_symbol_id);

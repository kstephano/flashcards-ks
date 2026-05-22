-- Database views for analytics
CREATE OR REPLACE VIEW v_cache_hit_rate_daily AS
SELECT
  date_trunc('day', timestamp) AS day,
  COUNT(*) FILTER (WHERE cache_hit) * 100.0 / NULLIF(COUNT(*), 0) AS hit_rate_pct,
  COUNT(*) AS total_calls
FROM api_usage_log
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;

CREATE OR REPLACE VIEW v_judge_scores_by_template AS
SELECT
  prompt_template_version,
  AVG(accuracy_score) AS avg_accuracy,
  AVG(relevance_score) AS avg_relevance,
  COUNT(*) AS card_count
FROM cards
WHERE accuracy_score IS NOT NULL
GROUP BY prompt_template_version;

CREATE OR REPLACE VIEW v_pipeline_latency AS
SELECT
  pipeline_step,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms) AS p50_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95_ms
FROM api_usage_log
WHERE timestamp >= NOW() - INTERVAL '7 days' AND latency_ms IS NOT NULL
GROUP BY pipeline_step;

CREATE OR REPLACE VIEW v_cost_per_card AS
SELECT
  date_trunc('day', j.completed_at) AS day,
  SUM(j.actual_cost_usd) / NULLIF(COUNT(c.id), 0) AS cost_per_card
FROM generation_jobs j
JOIN cards c ON c.deck_id = j.deck_id
WHERE j.status = 'complete' AND j.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;

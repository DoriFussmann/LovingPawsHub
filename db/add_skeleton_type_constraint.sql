-- Migration: enforce one skeleton per content_type per cluster
-- Run this once against the live database after cleaning up any existing
-- duplicate (cluster_id, content_type) pairs via the admin cleanup tool.
--
-- If duplicates still exist when this runs it will fail with a unique
-- violation — use /admin/controls -> "fix duplicate skeletons" first.

ALTER TABLE article_skeletons
  ADD CONSTRAINT uq_skeleton_cluster_type UNIQUE (cluster_id, content_type);

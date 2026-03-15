-- Per-region classification: add confidence and spatial zone to diff_regions
ALTER TABLE diff_regions ADD COLUMN region_confidence integer;
ALTER TABLE diff_regions ADD COLUMN spatial_zone text;

-- DOM positions for layout shift detection
ALTER TABLE snapshots ADD COLUMN dom_positions jsonb;

-- Layout shifts table for cross-snapshot element displacement tracking
CREATE TABLE layout_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diff_report_id uuid NOT NULL REFERENCES diff_reports(id),
  selector text NOT NULL,
  tag_name text NOT NULL,
  baseline_x integer NOT NULL,
  baseline_y integer NOT NULL,
  baseline_width integer NOT NULL,
  baseline_height integer NOT NULL,
  current_x integer NOT NULL,
  current_y integer NOT NULL,
  current_width integer NOT NULL,
  current_height integer NOT NULL,
  displacement_x integer NOT NULL,
  displacement_y integer NOT NULL,
  magnitude integer NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

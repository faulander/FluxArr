-- Add content_type to filters to distinguish show vs movie filters
ALTER TABLE filters ADD COLUMN content_type TEXT NOT NULL DEFAULT 'show';

CREATE INDEX idx_filters_content_type ON filters(content_type);

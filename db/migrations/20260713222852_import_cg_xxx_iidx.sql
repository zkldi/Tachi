-- CG IIDX import types (dev, gan, nag) were missing from the genesis import_type enum.

ALTER TYPE import_type ADD VALUE 'api/cg-dev-iidx';
ALTER TYPE import_type ADD VALUE 'api/cg-gan-iidx';
ALTER TYPE import_type ADD VALUE 'api/cg-nag-iidx';

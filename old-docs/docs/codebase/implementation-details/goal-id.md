# Goal ID implementation

Goal IDs exist to dedupe goals when a user creates
a new goal. For example, if a user wants to create a
HARD CLEAR Mei goal, but one already exists, we should
not insert two [Goal Documents](../../schemas/goal.md)
representing the same thing.

---

## Hashing

To create the Goal ID, we perform a [JSON stable hash](https://github.com/zkldi/fast-json-stable-hash) on the
`game`, `playtype`, `charts` and `criteria` of this field.

This enforces that goals are unique on those fields.

The above hash is then returned, prefixed with `G`.

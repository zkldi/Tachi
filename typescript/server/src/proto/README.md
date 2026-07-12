# GRPC definitions and generated code

This directory includes proto definitions for dependent services. Currently, that is only MYT. Unnecessary definitions are stripped.

- `myt/` contains proto definitions
- `generated/` contains automatically generated js/ts corresponding to these protos. DO NOT EDIT - see below

## regenerating autogen code

Anything in `generated/` should not be manually edited. If it needs to be updated, edit the protobuf definitions, then regenerate the autogen code by running `$ pnpm regen-grpc`.

The generated code is checked into the repository since it's much easier to deal with it that way. This is standard for projects using GRPC.
# Game Support

Tachi is a *modular* score tracker. What that means is that you can define your own
support for games in Tachi, and as long as the module is loaded, that support will
be enabled on this Tachi instance.

## What games are supported?

See 'Game Information' in the sidebar for a list of all supported games and their configurations.

## How do I write support for a game?

Adding support for a game requires configuration in three places and a loading of `seeds`.

You will need to:

- [Create a configuration in common](./common-config/index.md).
- [Implement it in the server](./server-impl.md).
- [Implement it in the client](./client-impl.md).
- [Load songs, charts, folders, etc.](./seeds.md).

For more information on how to write each module and what they contain, click on the specific item.

## How do I enable that support?

In your `server`'s `conf.json5` file, add the game to `TACHI_CONFIG.GAMES`. This will enable this module.

# Game Endpoints

These endpoints cover all games and specific games. For
specific playtypes, see [Game:Playtype Endpoints](./gpt.md).

*****

## Retrieve all supported games.

`GET /api/v1/games`

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `supportedGames` | String[] | The list of games this service supports. |
| `configs` | Record&lt;Game, [GameConfig](../../codebase/implementation-details/game-configuration.md)&gt; | Contains a mapping of every supported game to its configuration. |

### Example

#### Request
```
GET /api/v1/games
```

#### Response

```json
{
	"supportedGames": ["iidx", "bms"],
	"configs": {
		"iidx": {
			"name": "beatmania IIDX",
			// ...
		},
		"bms": {
			"name": "BMS",
			// ...
		}
	}
}
```

*****

## Retrieve a specific games' configuration.

`GET /api/v1/games/:game`

### Parameters

None.

### Response

| Property | Type | Description |
| :: | :: | :: |
| `<body>` | GameConfig | The configuration for this game. |

### Example

#### Request
```
GET /api/v1/games/iidx
```

#### Response

```json
{
	"name": "beatmania IIDX",
	"validPlaytypes": ["SP", "DP"],
}
```
